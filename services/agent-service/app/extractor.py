"""
LangChain-based slot extractor.

Each turn we call the LLM with:
  - The current slot state (what we already know)
  - Which slot we just asked about (`target_slot`)
  - The user's latest message

…and the LLM returns a structured `ExtractionResult` describing:
  - any slots we can fill from this message
  - whether the user refused the current slot

The result is merged into the session's SlotState.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, ValidationError

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage

from .llm import get_llm
from .slots import (
    SlotState, KNOWN_OCCASIONS, KNOWN_COLORS, KNOWN_DESTINATIONS, KNOWN_MONTHS,
)


# ── Structured output schema the LLM is asked to return ──────────────────────
class ExtractionResult(BaseModel):
    """Slot updates extracted from the user's latest message. Omit a field if
    the message doesn't specify it. Use null/[] for fields you can't extract."""

    occasion: Optional[str] = Field(
        default=None,
        description=f"One of {KNOWN_OCCASIONS}, or null if not stated.",
    )
    destination: Optional[str] = Field(
        default=None,
        description="City or place name, e.g. 'Tokyo'. Null if not stated.",
    )
    month: Optional[str] = Field(
        default=None,
        description=f"Full month name, one of {KNOWN_MONTHS}. Null if not stated.",
    )
    gender: Optional[str] = Field(
        default=None,
        description="'male' or 'female' (maps to Menswear/Ladieswear). Null if not stated.",
    )
    num_outfits: Optional[int] = Field(
        default=None, description="Integer 1..5, or null."
    )
    max_price: Optional[float] = Field(
        default=None, description="Budget per outfit in SGD (number), or null."
    )
    preferred_colors: Optional[list[str]] = Field(
        default=None,
        description=f"Colours the user likes, from {KNOWN_COLORS}. [] if none stated.",
    )
    avoid_colors: Optional[list[str]] = Field(
        default=None,
        description=f"Colours the user dislikes, from {KNOWN_COLORS}. [] if none stated.",
    )
    refused_target: bool = Field(
        default=False,
        description=(
            "True iff the user explicitly declined to answer the question we "
            "just asked (e.g. 'skip', 'no preference', 'pass', 'whatever', "
            "'you choose')."
        ),
    )


SYSTEM_PROMPT = """You are a slot-filling NLU module for a fashion recommender.
You read the user's latest chat message and extract structured slot values.

Rules:
- Only fill slots that are clearly supported by the user's message.
- If a field isn't mentioned, leave it null (or empty list for list fields).
- Normalise values to the closest canonical option where a list is given.
- Detect refusals: if the user says 'skip', 'no preference', 'pass', 'you choose',
  'whatever', or otherwise declines to answer the question we just asked, set
  refused_target=true.
- Gender: 'male'|'man'|'guy'|'menswear' → 'male'; 'female'|'woman'|'ladies' → 'female'.
- Budget: extract the numeric upper bound in SGD. 'around 200' → 200, '150-250' → 250.
- Colours: only include colours from the allowed list.
"""


def _build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human",
         "Current known slots (JSON): {state}\n"
         "Slot we just asked about: {target_slot}\n"
         "User's latest message: {message}\n"
         "Return the structured extraction."),
    ])


def extract(state: SlotState, target_slot: Optional[str],
            user_message: str) -> ExtractionResult:
    """Run the extractor chain. On any error, return an empty result so the
    caller can re-ask without crashing."""
    try:
        llm = get_llm().with_structured_output(ExtractionResult)
        prompt = _build_prompt()
        chain = prompt | llm
        result = chain.invoke({
            "state": state.model_dump(),
            "target_slot": target_slot or "unknown",
            "message": user_message,
        })
        # Some backends return a dict instead of the pydantic model.
        if isinstance(result, dict):
            result = ExtractionResult(**result)
        return result
    except (ValidationError, Exception) as e:
        print(f"[agent-service] extractor error: {e}")
        return ExtractionResult()


# ── Merge extraction into slot state ─────────────────────────────────────────
def merge(state: SlotState, target_slot: Optional[str],
          result: ExtractionResult) -> None:
    """Apply a (validated) extraction to the slot state in-place."""
    # Refusal applies only to the slot we just asked about.
    if result.refused_target and target_slot:
        state.slot(target_slot).mark_refused()

    if result.occasion:
        state.occasion.mark_filled(result.occasion)
    if result.destination:
        state.destination.mark_filled(result.destination)
    if result.month:
        state.month.mark_filled(result.month)
    if result.gender:
        state.gender.mark_filled(result.gender)
    if result.num_outfits is not None:
        n = max(1, min(5, int(result.num_outfits)))
        state.num_outfits.mark_filled(n)
    if result.max_price is not None:
        state.max_price.mark_filled(float(result.max_price))
    if result.preferred_colors is not None:
        # Empty list is still a valid "fill" if the user explicitly said none;
        # but treat [] as "no signal" to avoid prematurely closing the slot —
        # except when the slot was the target (user directly addressed it).
        if result.preferred_colors or target_slot == "preferred_colors":
            state.preferred_colors.mark_filled(result.preferred_colors)
    if result.avoid_colors is not None:
        if result.avoid_colors or target_slot == "avoid_colors":
            state.avoid_colors.mark_filled(result.avoid_colors)
