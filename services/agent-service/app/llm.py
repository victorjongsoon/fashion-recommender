"""
LLM wrapper — OpenAI chat completions.

Required env:
  OPENAI_API_KEY — from https://platform.openai.com/settings/.../api-keys
Optional env:
  OPENAI_MODEL   — default "gpt-4o-mini"
"""
from __future__ import annotations

import os
from functools import lru_cache

from langchain_openai import ChatOpenAI

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()

MODEL_ID = OPENAI_MODEL


@lru_cache(maxsize=1)
def get_llm() -> ChatOpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Put it in the repo-root .env file "
            "(copy .env.example) or export it in your shell."
        )
    return ChatOpenAI(
        model=OPENAI_MODEL,
        api_key=OPENAI_API_KEY,
        temperature=0.0,
        timeout=60,
    )


def pull_model_best_effort() -> None:
    """No-op for OpenAI — hosted, nothing to pull."""
    print(f"[agent-service] using OpenAI model {OPENAI_MODEL}")
