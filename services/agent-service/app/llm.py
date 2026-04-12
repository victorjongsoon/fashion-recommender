"""
LangChain + Ollama LLM wrapper.

Exposes a single `get_llm()` returning a ChatOllama instance configured from
environment variables, plus a best-effort startup pull over Ollama's HTTP API.
"""
from __future__ import annotations

import os
from functools import lru_cache

import httpx
from langchain_ollama import ChatOllama

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")


@lru_cache(maxsize=1)
def get_llm() -> ChatOllama:
    return ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_HOST,
        temperature=0.0,
    )


def pull_model_best_effort() -> None:
    """Best-effort pull so the first request doesn't stall on model download."""
    try:
        with httpx.Client(timeout=None) as c:
            tags = c.get(f"{OLLAMA_HOST}/api/tags", timeout=5.0).json()
            existing = [m.get("name", "") for m in (tags.get("models") or [])]
            if any(OLLAMA_MODEL in m for m in existing):
                print(f"[agent-service] {OLLAMA_MODEL} already available.")
                return
            print(f"[agent-service] pulling {OLLAMA_MODEL} …")
            # Stream the pull; discard progress output, just wait for completion.
            with c.stream("POST", f"{OLLAMA_HOST}/api/pull",
                          json={"name": OLLAMA_MODEL}) as r:
                for _ in r.iter_lines():
                    pass
            print(f"[agent-service] {OLLAMA_MODEL} ready.")
    except Exception as e:
        # Best-effort: don't crash the service if Ollama isn't ready yet.
        print(f"[agent-service] model pull skipped: {e}")
