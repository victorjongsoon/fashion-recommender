"""
Build the `results` payload consumed by `context-input-screen.tsx`.

Shape:
    {
      "extracted": {occasion, destination, month, gender, num_outfits,
                    max_price, colours_liked, colours_disliked, season},
      "kg_inputs": [ { occasion, category, num_outfits, max_price,
                       preferred_colors, avoid_colors, season,
                       gender, destination, month, avg_temp_c, rain_prob }, ... ]
    }
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from .slots import SlotState, SLOT_DEFAULTS

WEATHER_SERVICE_URL = os.environ.get("WEATHER_SERVICE_URL", "http://weather-service:8000")
MAX_KG_GROUPS = 20


def _val(state: SlotState, key: str) -> Any:
    s = state.slot(key)
    if s.filled:
        return s.value
    return SLOT_DEFAULTS[key]


def _to_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    return [str(v)]


def _gender_to_category(g: str) -> str:
    return "Menswear" if str(g).lower().startswith("m") else "Ladieswear"


def _fetch_season(destination: str, month: str) -> str:
    """Call weather-service for a season; fall back to 'spring' on failure."""
    try:
        with httpx.Client(timeout=5.0) as c:
            r = c.get(
                f"{WEATHER_SERVICE_URL}/weather",
                params={"destination": destination, "month": month},
            )
            if r.status_code == 200:
                return (r.json() or {}).get("season", "spring")
    except Exception as e:
        print(f"[agent-service] weather fetch failed: {e}")
    return "spring"


def build_results(state: SlotState) -> dict:
    occasion_raw     = _val(state, "occasion")
    destination_raw  = _val(state, "destination")
    month_raw        = _val(state, "month")
    gender_raw       = _val(state, "gender")
    num_outfits      = int(_val(state, "num_outfits"))
    max_price        = float(_val(state, "max_price"))
    preferred_colors = _to_list(_val(state, "preferred_colors"))
    avoid_colors     = _to_list(_val(state, "avoid_colors"))

    destinations = _to_list(destination_raw)
    months       = _to_list(month_raw)
    occasions    = _to_list(occasion_raw)
    genders      = _to_list(gender_raw)

    # Season per (destination, month)
    combos: list[dict] = []
    for dest in destinations:
        for mon in months:
            combos.append({
                "destination": dest,
                "month": mon,
                "season": _fetch_season(dest, mon),
            })

    kg_inputs_raw: list[dict] = []
    for c in combos:
        for g in genders:
            for o in occasions:
                kg_inputs_raw.append({
                    "occasion":         o,
                    "category":         _gender_to_category(g),
                    "num_outfits":      num_outfits,
                    "max_price":        max_price,
                    "preferred_colors": preferred_colors,
                    "avoid_colors":     avoid_colors,
                    "season":           c["season"],
                    # display-only fields:
                    "gender":           g,
                    "destination":      c["destination"],
                    "month":            c["month"],
                })

    # Dedupe by (destination, season, occasion, category) — same KG inputs.
    seen: set[str] = set()
    kg_inputs: list[dict] = []
    for item in kg_inputs_raw:
        key = f"{item['destination']}|{item['season']}|{item['occasion']}|{item['category']}"
        if key not in seen:
            seen.add(key)
            kg_inputs.append(item)
    if len(kg_inputs) > MAX_KG_GROUPS:
        kg_inputs = kg_inputs[:MAX_KG_GROUPS]

    season = combos[0]["season"] if combos else "summer"

    extracted = {
        "occasion":         ", ".join(occasions),
        "destination":      ", ".join(destinations),
        "month":            ", ".join(months),
        "gender":           ", ".join(genders),
        "num_outfits":      str(num_outfits),
        "max_price":        str(int(max_price)),
        "colours_liked":    ", ".join(preferred_colors) or "none",
        "colours_disliked": ", ".join(avoid_colors) or "none",
        "season":           season,
    }

    return {"extracted": extracted, "kg_inputs": kg_inputs}


# Keys the frontend's `context-input-screen.tsx` reads from `results`.
REQUIRED_EXTRACTED_KEYS = {
    "occasion", "destination", "month", "gender", "num_outfits",
    "max_price", "colours_liked", "colours_disliked", "season",
}
REQUIRED_KG_INPUT_KEYS = {
    "occasion", "category", "num_outfits", "max_price",
    "preferred_colors", "avoid_colors", "season",
    "gender", "destination", "month",
}
