"""
main.py — StyleAdvisor Agent Service
FastAPI wrapper around outfit_agent_core.py (new version).

ENDPOINTS
  GET  /health         → health check
  GET  /api/start      → start a chat session (returns first question)
  POST /api/message    → send one chat reply (returns next question or final results)
"""

import uuid, json, re, os, datetime
from itertools import groupby
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

os.environ.setdefault("OLLAMA_HOST",
    os.environ.get("OLLAMA_HOST", "http://ollama:11434"))

from outfit_agent_core import (
    STEPS, REFUSAL_ACK,
    DEFAULT_BUDGET, DEFAULT_MONTH,
    MONTH_TO_NUM, MONTH_ABBR,
    ALL_GENDERS, ALL_OCCASIONS,
    classify_reply,               # ← new single-call classifier
    final_reconcile, apply_defaults,
    get_weather,
    _to_list, parse_budget_ranges,
    _R_RELEVANT, _R_EXPLICIT_REFUSE,  # ← result constants
)

app = FastAPI(title="StyleAdvisor Agent Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agent-service"}


# ── /api/start + /api/message ─────────────────────────────────────────────────

SESSIONS: dict[str, dict] = {}

def _new_session():
    return {
        "step_idx": 0,
        "attempts": 0,
        "history":  [],
        "done":     False,
        "results":  None,
    }

@app.get("/api/start")
def start():
    sid = str(uuid.uuid4())
    SESSIONS[sid] = _new_session()
    return {
        "session_id": sid,
        "message":    STEPS[0]["question"],
        "done":       False,
    }

class Msg(BaseModel):
    session_id: str
    message:    str

@app.post("/api/message")
def message(req: Msg):
    s = SESSIONS.get(req.session_id)
    if not s:
        raise HTTPException(404, "Session not found — please refresh.")
    if s["done"]:
        return {"message": "Done!", "done": True, "results": s["results"]}

    step = STEPS[s["step_idx"]]
    key  = step["key"]
    raw  = req.message.strip()

    # Always record every reply
    s["history"].append({"question": step["question"], "answer": raw})

    # Single classify call (replaces is_relevant + is_explicit_refusal)
    verdict = classify_reply(key, raw)

    if verdict == _R_RELEVANT:
        return _advance(s, "Got it! ")

    if verdict == _R_EXPLICIT_REFUSE:
        return _advance(s, REFUSAL_ACK[key])

    # Off-topic → re-ask up to 3 times
    s["attempts"] += 1
    if s["attempts"] >= 3:
        return _advance(s, "Moving on!")

    remaining = 3 - s["attempts"]
    hint = step.get("hint", "")
    plural = "s" if remaining > 1 else ""
    return {
        "message": (
            f"I didn't quite catch that. Could you try again? "
            f"({remaining} attempt{plural} left)\n"
            f"Hint: {hint}\n"
            f"Or say 'refuse' to skip."
        ),
        "done": False,
    }


def _advance(s, ack):
    s["step_idx"] += 1
    s["attempts"] = 0

    if s["step_idx"] >= len(STEPS):
        results = _build_results(s["history"])
        s["done"]    = True
        s["results"] = results
        return {"message": ack, "done": True, "results": results}

    return {
        "message": f"{ack}\n\n{STEPS[s['step_idx']]['question']}",
        "done":    False,
    }


def _build_results(history):
    """
    Reconcile → defaults → weather → build extracted dict.
    Returns data the frontend uses to call the recommender-service.
    """
    reconciled = final_reconcile(history)
    answers    = apply_defaults(reconciled)

    # ── Budget → single max_price value ──────────────────────────────────────
    budgets   = answers["budget"] if isinstance(answers["budget"], list) else DEFAULT_BUDGET
    max_price = max(b["upper"] for b in budgets) if budgets else 500

    # ── Colours → lists matching KG colour values ─────────────────────────────
    colours_liked    = _parse_colours_to_list(answers.get("colours_liked", ""))
    colours_disliked = _parse_colours_to_list(answers.get("colours_disliked", ""))

    # ── Num outfits → scan history ────────────────────────────────────────────
    num_outfits = _extract_num_outfits(history)

    # ── Normalise destinations / months / occasions / genders ─────────────────
    destinations = _to_list(answers["destination"])
    months_raw   = (answers["month"] if isinstance(answers["month"], list)
                    else _to_list(answers["month"]))
    months = [MONTH_ABBR.get(m[:3], m) for m in [str(x) for x in months_raw]]
    months = [m for m in months if m in MONTH_TO_NUM] or [DEFAULT_MONTH]
    occasions = (answers["occasion"] if isinstance(answers["occasion"], list)
                 else _to_list(answers["occasion"]))
    genders = (answers["gender"] if isinstance(answers["gender"], list)
               else [answers["gender"]])

    # ── Weather combos ────────────────────────────────────────────────────────
    combos = []
    for dest in destinations:
        for month in months:
            w = get_weather(dest, month)
            combos.append({"destination": dest, "month": month, "weather": w})

    # ── Build kg_inputs — this is what gets sent to recommender-service ───────
    # Format matches RecommendRequest in recommender-service/main.py:
    #   occasion, category (from gender), num_outfits, max_price,
    #   preferred_colors, avoid_colors, season
    kg_inputs_raw = []
    for c in combos:
        w = c["weather"]
        for g in genders:
            for o in occasions:
                kg_inputs_raw.append({
                    # ── Fields the recommender-service needs ──
                    "occasion":          o,
                    "category":          "Menswear" if g == "male" else "Ladieswear",
                    "num_outfits":       num_outfits,
                    "max_price":         max_price,
                    "preferred_colors":  colours_liked,
                    "avoid_colors":      colours_disliked,
                    "season":            w["season"],
                    # ── Extra context (weather, displayed in frontend) ──
                    "gender":            g,
                    "destination":       c["destination"],
                    "month":             c["month"],
                    "avg_temp_c":        w["avg_temp_c"],
                    "rain_prob":         w["rain_prob"],
                })

    # ── Deduplicate by season (not month) — same season = same KG results ─────
    # Key: destination|season|occasion|category (month differences collapse)
    _seen_keys = set()
    kg_inputs = []
    for item in kg_inputs_raw:
        key = f"{item['destination']}|{item['season']}|{item['occasion']}|{item['category']}"
        if key not in _seen_keys:
            _seen_keys.add(key)
            kg_inputs.append(item)

    # ── Hard cap at 20 groups to prevent Neo4j overload ──────────────────────
    MAX_GROUPS = 20
    if len(kg_inputs) > MAX_GROUPS:
        print(f"WARNING: Capping kg_inputs from {len(kg_inputs)} to {MAX_GROUPS}")
        kg_inputs = kg_inputs[:MAX_GROUPS]

    print(f"kg_inputs: {len(kg_inputs_raw)} raw → {len(kg_inputs)} after dedup+cap")

    # ── extracted dict → read by context-input-screen.tsx ────────────────────
    def fmt(v):
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return ", ".join(
                f"{b.get('currency','SGD')} {b.get('lower','')}–{b['upper']}" for b in v
            )
        if isinstance(v, list):
            return ", ".join(str(x) for x in v)
        return str(v)

    extracted = {k: fmt(v) for k, v in answers.items()}
    extracted["colours_liked"]    = ", ".join(colours_liked)    or "none"
    extracted["colours_disliked"] = ", ".join(colours_disliked) or "none"
    extracted["num_outfits"]      = str(num_outfits)
    extracted["max_price"]        = str(max_price)
    extracted["season"]           = combos[0]["weather"]["season"] if combos else "summer"

    return {
        "extracted": extracted,   # → context-input-screen reads this
        "kg_inputs": kg_inputs,   # → full data for debugging
    }


# ── Colour helpers ────────────────────────────────────────────────────────────

_KNOWN_COLOURS = [
    "Black", "White", "Grey", "Dark Blue", "Light Blue", "Blue",
    "Red", "Dark Red", "Pink", "Light Pink", "Green", "Dark Green",
    "Yellow", "Orange", "Dark Orange", "Purple", "Beige", "Brown",
    "Gold", "Silver", "Bronze/Copper", "Khaki Green"
]

def _parse_colours_to_list(raw: str) -> list[str]:
    """Convert colour string from apply_defaults → KG-compatible list."""
    if not raw or raw.lower() in ("no preference", "none", "null", ""):
        return []
    found = []
    raw_lower = raw.lower()
    for c in _KNOWN_COLOURS:
        if c.lower() in raw_lower:
            found.append(c)
    return found

def _extract_num_outfits(history) -> int:
    for h in history:
        if "how many" in h.get("question", "").lower():
            nums = re.findall(r'\b([1-5])\b', h.get("answer", ""))
            if nums:
                return int(nums[0])
    return 3


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
