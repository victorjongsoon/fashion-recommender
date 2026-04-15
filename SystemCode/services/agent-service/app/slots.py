"""
Slot schema for the FashionAI slot-filling agent.

Each slot tracks: value (typed), filled (bool), refused (bool).
- filled=True  → we have a usable value
- refused=True → user declined; fall back to a default downstream
- both False   → still need to ask

Required slots are the ones the recommender-service + frontend need.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class Slot(BaseModel):
    value: Any = None
    filled: bool = False
    refused: bool = False

    def mark_filled(self, v: Any) -> None:
        self.value = v
        self.filled = True
        self.refused = False

    def mark_refused(self) -> None:
        self.refused = True
        self.filled = False

    @property
    def done(self) -> bool:
        return self.filled or self.refused


class SlotState(BaseModel):
    occasion: Slot = Field(default_factory=Slot)
    destination: Slot = Field(default_factory=Slot)
    month: Slot = Field(default_factory=Slot)
    gender: Slot = Field(default_factory=Slot)
    num_outfits: Slot = Field(default_factory=Slot)
    max_price: Slot = Field(default_factory=Slot)
    preferred_colors: Slot = Field(default_factory=Slot)   # value: list[str]
    avoid_colors: Slot = Field(default_factory=Slot)       # value: list[str]

    def slot(self, key: str) -> Slot:
        return getattr(self, key)

    def next_empty(self) -> Optional[str]:
        for k in REQUIRED_SLOTS:
            if not self.slot(k).done:
                return k
        return None

    def all_done(self) -> bool:
        return self.next_empty() is None


REQUIRED_SLOTS: list[str] = [
    "occasion",
    "destination",
    "month",
    "gender",
    "num_outfits",
    "max_price",
    "preferred_colors",
    "avoid_colors",
]

# Defaults for when a slot is refused.
SLOT_DEFAULTS: dict[str, Any] = {
    "occasion": "Casual",
    "destination": "Singapore",
    "month": "June",
    "gender": "male",
    "num_outfits": 3,
    "max_price": 200,
    "preferred_colors": [],
    "avoid_colors": [],
}


# Known vocabulary for normalisation / validation
KNOWN_OCCASIONS = ["Casual", "Formal", "Sport", "Party"]
# User-facing palette. Imported from colors.py so backend/frontend stay in sync.
from .colors import PALETTE as KNOWN_COLORS  # noqa: E402
KNOWN_DESTINATIONS = [
    "Tokyo", "Seoul", "Bangkok", "Singapore", "Bali",
    "Sydney", "London", "Paris", "Rome", "Barcelona",
    "Amsterdam", "Dubai", "Istanbul", "New York", "Los Angeles",
    "San Francisco", "Miami", "Toronto", "Reykjavik", "Cape Town",
]
KNOWN_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
