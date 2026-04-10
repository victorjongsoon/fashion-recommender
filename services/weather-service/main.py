"""
Weather Service — provides weather data for destinations.

ENDPOINTS
  GET  /health                          → health check
  GET  /weather?destination=X&month=Y   → weather data for destination + month
"""

import json, urllib.request, urllib.parse
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Weather Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONTH_TO_NUM = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june",
     "july", "august", "september", "october", "november", "december"], 1)}

MONTH_ABBR = {
    "jan": "january", "feb": "february", "mar": "march", "apr": "april",
    "may": "may", "jun": "june", "jul": "july", "aug": "august",
    "sep": "september", "oct": "october", "nov": "november", "dec": "december",
}


def _season(n: int) -> str:
    if n in (3, 4, 5):   return "spring"
    if n in (6, 7, 8):   return "summer"
    if n in (9, 10, 11): return "autumn"
    return "winter"


def _fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())


def _geocode(place: str):
    q = urllib.parse.quote(place)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1&language=en&format=json"
    try:
        res = _fetch_json(url).get("results", [])
        if res:
            return res[0]["latitude"], res[0]["longitude"], res[0].get("name", place)
    except Exception:
        pass
    return None, None, place


@app.get("/health")
def health():
    return {"status": "ok", "service": "weather-service"}


@app.get("/weather")
def weather(
    destination: str = Query(..., description="City or place name"),
    month: str = Query(..., description="Month name (e.g. january, feb)"),
):
    # Normalise month
    month_lower = month.strip().lower()
    if month_lower[:3] in MONTH_ABBR:
        month_lower = MONTH_ABBR[month_lower[:3]]
    mon_num = MONTH_TO_NUM.get(month_lower, 3)
    season = _season(mon_num)

    try:
        lat, lon, resolved = _geocode(destination)
        if lat is None:
            raise ValueError("geocode failed")

        all_t, all_p = [], []
        for yr in [2015, 2016, 2017, 2018, 2019]:
            days = 28 if mon_num == 2 else 30 if mon_num in (4, 6, 9, 11) else 31
            start = f"{yr}-{mon_num:02d}-01"
            end = f"{yr}-{mon_num:02d}-{days:02d}"
            url = (
                f"https://archive-api.open-meteo.com/v1/archive"
                f"?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}"
                f"&daily=temperature_2m_mean,precipitation_sum&timezone=auto"
            )
            try:
                d = _fetch_json(url).get("daily", {})
                all_t.extend(t for t in d.get("temperature_2m_mean", []) if t is not None)
                all_p.extend(p for p in d.get("precipitation_sum", []) if p is not None)
            except Exception:
                pass

        if not all_t:
            raise ValueError("no data")

        avg_t = round(sum(all_t) / len(all_t), 1)
        rain = round(min((sum(all_p) / 5 if all_p else 60) / 150, 1.0), 2)

        return {
            "avg_temp_c": avg_t,
            "season": season,
            "rain_prob": rain,
            "source": f"Open-Meteo ({resolved}, {month_lower.title()})",
        }
    except Exception as e:
        print(f"Weather error ({e}) — using season fallback")
        return {
            "avg_temp_c": 20,
            "season": season,
            "rain_prob": 0.30,
            "source": "fallback",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
