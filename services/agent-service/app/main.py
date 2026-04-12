"""
FastAPI app for the FashionAI slot-filling agent-service.

Endpoints:
  GET  /health       → health check
  GET  /api/start    → start a session; returns the welcome + first question
  POST /api/message  → send one user message; returns next question or results
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .extractor import extract, merge
from .llm import pull_model_best_effort, OLLAMA_MODEL
from .questions import WELCOME, OPENING_QUESTION, question_for
from .results import build_results
from .sessions import Session, SessionStore

app = FastAPI(title="FashionAI Agent Service", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

store = SessionStore()


@app.on_event("startup")
def _startup() -> None:
    pull_model_best_effort()


@app.get("/health")
def health():
    return {"status": "ok", "service": "agent-service", "model": OLLAMA_MODEL}


@app.get("/api/start")
def start():
    s = store.create()
    # Open-ended first turn: ask for everything. No current_slot targeting —
    # the extractor will pull whatever the user gives us in free-form text.
    s.current_slot = None
    message = f"{WELCOME}\n\n{OPENING_QUESTION}"
    s.history.append({"role": "agent", "text": message})
    return {"session_id": s.session_id, "message": message, "done": False}


class MessageIn(BaseModel):
    session_id: str
    message: str


@app.post("/api/message")
def message(req: MessageIn):
    s: Session | None = store.get(req.session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found — please refresh.")

    if s.done:
        return {"message": "Done!", "done": True, "results": s.results}

    user_text = (req.message or "").strip()
    s.history.append({"role": "user", "text": user_text})

    # 1. Extract slot updates from this user turn.
    result = extract(s.state, s.current_slot, user_text)
    merge(s.state, s.current_slot, result)

    # 2. All required slots done → build results and finish.
    if s.state.all_done():
        s.results = build_results(s.state)
        s.done = True
        final_msg = "Perfect — I've got everything I need. Loading your recommendations…"
        s.history.append({"role": "agent", "text": final_msg})
        return {"message": final_msg, "done": True, "results": s.results}

    # 3. Otherwise, ask about what's still missing. If several slots are
    #    missing, batch them in one message (but target the first one for the
    #    extractor's refusal detection).
    missing = _missing_slots(s.state)
    s.current_slot = missing[0] if missing else None
    next_msg = _compose_followup(missing)
    s.history.append({"role": "agent", "text": next_msg})
    return {"message": next_msg, "done": False}


def _missing_slots(state) -> list[str]:
    from .slots import REQUIRED_SLOTS
    return [k for k in REQUIRED_SLOTS if not state.slot(k).done]


def _compose_followup(missing: list[str]) -> str:
    """One message that asks about up to 3 missing slots at once."""
    if not missing:
        return "Anything else?"
    if len(missing) == 1:
        return f"Just one more thing — {question_for(missing[0])}"
    batch = missing[:3]
    bullets = "\n".join(f"  • {question_for(k)}" for k in batch)
    rest = ""
    if len(missing) > 3:
        rest = f"\n\n(We'll cover the remaining {len(missing) - 3} after this.)"
    return f"Thanks! I still need a few details:\n{bullets}{rest}"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
