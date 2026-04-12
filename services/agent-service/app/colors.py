"""
Colour vocabulary shared by the slot extractor and the KG query.

`PALETTE` — user-facing colour names. These are what the frontend shows,
            what the LLM normalises to, and what `SlotState` stores.

`PALETTE_TO_KG` — maps each palette name to the list of Neo4j colour IDs it
                  covers. When building kg_inputs we expand palette → KG so
                  the query matches every real variant.

Rationale: the KG has ~50 colour buckets (Light Blue, Dark Blue, Other Blue,
etc.) plus junk buckets (Unknown, Transparent, Other*). Exposing all of those
to users is overwhelming, and sending only a single palette name to the KG
under-matches the catalogue. Mapping one → many gets us both: simple UX and
a wide candidate pool.
"""
from __future__ import annotations

# User-facing palette (ordered for display).
PALETTE: list[str] = [
    "Black", "White", "Grey",
    "Blue", "Red", "Pink",
    "Green", "Yellow", "Orange",
    "Purple", "Beige", "Brown",
    "Turquoise", "Gold", "Silver",
]

# Hex for frontend display (kept here so FE & BE stay aligned; FE may duplicate).
PALETTE_HEX: dict[str, str] = {
    "Black":     "#000000",
    "White":     "#FFFFFF",
    "Grey":      "#808080",
    "Blue":      "#0066CC",
    "Red":       "#DC143C",
    "Pink":      "#FFB6C1",
    "Green":     "#228B22",
    "Yellow":    "#FFD700",
    "Orange":    "#FF8C00",
    "Purple":    "#9370DB",
    "Beige":     "#F5F5DC",
    "Brown":     "#8B4513",
    "Turquoise": "#40E0D0",
    "Gold":      "#DAA520",
    "Silver":    "#C0C0C0",
}

# Palette → KG colour-node IDs. Only real KG colours; exclude junk buckets
# (Unknown, Transparent, Other) from user-driven filtering.
PALETTE_TO_KG: dict[str, list[str]] = {
    "Black":     ["Black"],
    "White":     ["White", "Off White"],
    "Grey":      ["Grey", "Light Grey", "Dark Grey"],
    "Blue":      ["Blue", "Light Blue", "Dark Blue", "Other Blue"],
    "Red":       ["Red", "Light Red", "Dark Red", "Other Red"],
    "Pink":      ["Pink", "Light Pink", "Dark Pink", "Other Pink"],
    "Green":     ["Green", "Light Green", "Dark Green", "Other Green",
                  "Greenish Khaki"],
    "Yellow":    ["Yellow", "Light Yellow", "Dark Yellow", "Other Yellow"],
    "Orange":    ["Orange", "Light Orange", "Dark Orange", "Other Orange"],
    "Purple":    ["Purple", "Light Purple", "Dark Purple", "Other Purple"],
    "Beige":     ["Beige", "Light Beige", "Dark Beige", "Greyish Beige"],
    "Brown":     ["Yellowish Brown"],       # KG has no plain "Brown"
    "Turquoise": ["Turquoise", "Light Turquoise", "Dark Turquoise",
                  "Other Turquoise"],
    "Gold":      ["Gold"],
    "Silver":    ["Silver"],
}


def expand_to_kg(palette_colors: list[str]) -> list[str]:
    """Expand a list of palette names to the full set of KG colour IDs."""
    out: list[str] = []
    seen: set[str] = set()
    for name in palette_colors or []:
        for kg in PALETTE_TO_KG.get(name, []):
            if kg not in seen:
                seen.add(kg)
                out.append(kg)
    return out
