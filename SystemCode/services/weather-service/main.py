"""
Weather Service — returns the season for a destination + month.

Calls Open-Meteo's free geocoding API to verify the destination exists and to
detect whether it's in the Southern Hemisphere (so July in Sydney = winter, not
summer). Falls back to a Northern-Hemisphere month→season map if the geocoder
is unreachable.

ENDPOINTS
  GET  /health                          → health check
  GET  /weather?destination=X&month=Y   → { destination, resolved, month,
                                             season, verified, source }
"""
from __future__ import annotations

import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Weather Service", version="2.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Month → season (Northern Hemisphere) ─────────────────────────────────────
_MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]
_MONTH_TO_NUM = {m: i for i, m in enumerate(_MONTHS, 1)}
_MONTH_ABBR = {m[:3]: m for m in _MONTHS}

_NH_SEASON = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring",  4: "spring", 5: "spring",
    6: "summer",  7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}
_FLIP = {"winter": "summer", "summer": "winter",
         "spring": "autumn", "autumn": "spring"}

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


def _parse_month(raw: str) -> int | None:
    s = (raw or "").strip().lower()
    if s in _MONTH_TO_NUM:
        return _MONTH_TO_NUM[s]
    if s[:3] in _MONTH_ABBR:
        return _MONTH_TO_NUM[_MONTH_ABBR[s[:3]]]
    return None


def _geocode(place: str) -> dict | None:
    """Return {name, country, latitude, longitude} or None if not found."""
    try:
        with httpx.Client(timeout=5.0) as c:
            r = c.get(GEOCODE_URL, params={
                "name": place, "count": 1, "language": "en", "format": "json",
            })
            r.raise_for_status()
            results = (r.json() or {}).get("results") or []
            return results[0] if results else None
    except Exception:
        return None


@app.get("/health")
def health():
    return {"status": "ok", "service": "weather-service"}


@app.get("/weather")
def weather(
    destination: str = Query(..., description="City or place name"),
    month: str = Query(..., description="Month name (e.g. January, jan)"),
):
    month_num = _parse_month(month)
    if month_num is None:
        return {
            "destination": destination,
            "resolved": destination,
            "month": month,
            "season": "spring",
            "verified": False,
            "source": "fallback (bad month)",
        }

    geo = _geocode(destination)
    nh_season = _NH_SEASON[month_num]

    if geo is None:
        # Geocoder failed or destination not found → return NH season unverified.
        return {
            "destination": destination,
            "resolved": destination,
            "month": month,
            "season": nh_season,
            "verified": False,
            "source": "fallback (geocoder unavailable or unknown place)",
        }

    # Season by climate zone:
    #   - Tropics (|lat| <= 23.5°): always "summer" — no real winter/spring/autumn.
    #   - Southern Hemisphere (lat < -23.5°): flip the NH season.
    #   - Northern Hemisphere (lat >  23.5°): use the NH season directly.
    lat = geo.get("latitude", 0.0)
    if -23.5 <= lat <= 23.5:
        season = "summer"
    elif lat < 0:
        season = _FLIP[nh_season]
    else:
        season = nh_season

    return {
        "destination": destination,
        "resolved": f"{geo.get('name', destination)}, {geo.get('country', '')}".strip(", "),
        "month": month,
        "season": season,
        "verified": True,
        "source": "open-meteo geocoding",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
