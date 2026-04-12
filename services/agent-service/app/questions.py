"""Templated questions per slot. Keeps phrasing reproducible for evaluation."""
from __future__ import annotations

WELCOME = (
    "Welcome to FashionAI! I'm your style advisor — I'll help you plan outfits "
    "for your trip."
)

# Opening prompt: ask for everything in one go. The extractor can pick up
# whatever the user gives us; we only ask follow-ups for what's still missing.
OPENING_QUESTION = (
    "Tell me about your trip in a sentence or two — ideally include:\n"
    "  • Occasion (casual / formal / sport / party)\n"
    "  • Destination & month\n"
    "  • Menswear or ladieswear\n"
    "  • Number of outfits (1–5) and budget per outfit (SGD)\n"
    "  • Colours you love or want to avoid (optional)\n\n"
    "For example: \"Casual trip to Tokyo in June, menswear, 3 outfits under "
    "$200, like blue and black, avoid pink.\"\n"
    "You can also skip anything you're unsure about."
)

QUESTIONS: dict[str, str] = {
    "occasion":         "What's the occasion? (e.g. casual, formal, sport, party)",
    "destination":      "Where are you travelling to?",
    "month":            "Which month will you be there?",
    "gender":           "Are you looking for menswear or ladieswear?",
    "num_outfits":      "How many outfits would you like me to plan? (1–5)",
    "max_price":        "What's your budget per outfit in SGD?",
    "preferred_colors": "Any colours you'd love to wear? (say 'skip' for no preference)",
    "avoid_colors":     "Any colours you'd like to avoid? (say 'skip' if none)",
}


def question_for(slot: str) -> str:
    return QUESTIONS.get(slot, f"Could you tell me your {slot}?")
