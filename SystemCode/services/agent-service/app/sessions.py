"""In-memory session store for the agent-service."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional

from .slots import SlotState


@dataclass
class Session:
    session_id: str
    state: SlotState = field(default_factory=SlotState)
    history: list[dict] = field(default_factory=list)   # [{role, text}]
    current_slot: Optional[str] = None                   # slot we last asked about
    done: bool = False
    results: Optional[dict] = None


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self) -> Session:
        sid = str(uuid.uuid4())
        s = Session(session_id=sid)
        self._sessions[sid] = s
        return s

    def get(self, sid: str) -> Optional[Session]:
        return self._sessions.get(sid)
