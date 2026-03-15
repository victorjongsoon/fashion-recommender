"""
outfit_agent.py  —  powered by Ollama (free, local LLM, no API key needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-REQUISITES
  1. Install Ollama:   https://ollama.com/download
  2. Pull a model:     ollama pull gemma3          (recommended, ~3 GB)
                  or:  ollama pull llama3.2         (lighter alternative)
  3. Install library:  pip install ollama
  4. Run this script:  python outfit_agent.py

SWITCHING MODELS
  Change OLLAMA_MODEL below to any model you have pulled, e.g.:
    "llama3.2", "mistral", "phi3", "qwen2.5:3b"
"""

import sys
import json
import re
import datetime
import urllib.request
import urllib.parse

import ollama

# ── Model ─────────────────────────────────────────────────────────────────────
OLLAMA_MODEL = "gemma3"

# ── ANSI colours ──────────────────────────────────────────────────────────────
RESET   = "\033[0m";  BOLD    = "\033[1m";  DIM     = "\033[2m"
CYAN    = "\033[36m"; GREEN   = "\033[32m"; YELLOW  = "\033[33m"
RED     = "\033[31m"; MAGENTA = "\033[35m"; BLUE    = "\033[34m"

def agent(msg):  return f"{CYAN}{BOLD}Agent:{RESET} {msg}"
def user_prompt(): return f"{GREEN}{BOLD}You:  {RESET}"
def info(msg):   return f"{DIM}  -> {msg}{RESET}"
def divider():   return f"{DIM}{'─' * 54}{RESET}"
def highlight(label, value): return f"  {BOLD}{label:<12}{RESET}{YELLOW}{value}{RESET}"


# ── 1. BROADCAST CONSTANTS ────────────────────────────────────────────────────
# Used when user refuses a field — recommend across ALL values of that dimension.

ALL_SEASONS   = ["spring", "summer", "autumn", "winter"]
ALL_GENDERS   = ["male", "female"]
ALL_OCCASIONS = ["sports", "formal", "casual", "beach"]

# Default destination and month when user refuses
DEFAULT_DESTINATION = "singapore"
DEFAULT_MONTH       = datetime.date.today().strftime("%B").lower()  # e.g. "march"

# Maps field key -> (default_value, acknowledgement_message)
# destination -> single default place; month -> single default month
# gender/occasion -> broadcast lists (recommend all)
REFUSAL_DEFAULTS = {
    "gender":      (ALL_GENDERS,         "No problem — I'll show outfits for all styles."),
    "destination": (DEFAULT_DESTINATION, "No worries — I'll default to Singapore."),
    "month":       (DEFAULT_MONTH,       f"No worries — I'll use this month ({DEFAULT_MONTH.title()})."),
    "occasion":    (ALL_OCCASIONS,       "Got it — I'll show options for every type of occasion."),
}


# ── 2. WEATHER  (Open-Meteo — free, no API key needed) ───────────────────────
# Docs: https://open-meteo.com/en/docs
# Geocoding: https://open-meteo.com/en/docs/geocoding-api

MONTH_TO_NUM = {m: i for i, m in enumerate(
    ["january","february","march","april","may","june",
     "july","august","september","october","november","december"], 1
)}

def _season(n):
    """Northern-hemisphere season from month number."""
    if n in (3,4,5):   return "spring"
    if n in (6,7,8):   return "summer"
    if n in (9,10,11): return "autumn"
    return "winter"

def _fetch_json(url):
    """Tiny wrapper: urllib GET -> parsed JSON (no third-party lib needed)."""
    with urllib.request.urlopen(url, timeout=10) as resp:
        return json.loads(resp.read().decode())

def _geocode(place):
    """Return (lat, lon) for a place name via Open-Meteo geocoding API."""
    q   = urllib.parse.quote(place)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1&language=en&format=json"
    data = _fetch_json(url)
    results = data.get("results", [])
    if not results:
        return None, None
    return results[0]["latitude"], results[0]["longitude"]

def get_weather(destination, month):
    """
    Fetch real monthly climate normals from Open-Meteo Historical Climate API.
    Uses 30-year averages (1991-2020) so any future month works perfectly.
    API docs: https://open-meteo.com/en/docs/climate-api

    Returns: { avg_temp_c, season, rain_prob, source }
    Falls back gracefully if geocoding fails or API is unreachable.
    """
    mon_lower = month.lower().strip()
    mon_num   = next((v for k,v in MONTH_TO_NUM.items() if k.startswith(mon_lower[:3])), 3)
    season    = _season(mon_num)

    try:
        lat, lon = _geocode(destination)
        if lat is None:
            raise ValueError(f"Could not geocode '{destination}'")

        # Climate normals API — request a full representative year, extract target month
        # Uses ERA5 reanalysis data (1940-present), highly reliable
        url = (
            f"https://climate-api.open-meteo.com/v1/climate"
            f"?latitude={lat}&longitude={lon}"
            f"&start_date=1991-01-01&end_date=2020-12-31"
            f"&models=EC_Earth3P_HR"
            f"&monthly=temperature_2m_mean,precipitation_sum"
        )
        data = _fetch_json(url)
        monthly = data.get("monthly", {})

        # monthly time is like ["1991-01", "1991-02", ...] — find all entries for target month
        times  = monthly.get("time", [])
        temps  = monthly.get("temperature_2m_mean", [])
        precip = monthly.get("precipitation_sum", [])

        # Filter to the target month number across all years
        month_str = f"-{mon_num:02d}"
        month_temps  = [t for ts, t in zip(times, temps)  if month_str in ts and t is not None]
        month_precip = [p for ts, p in zip(times, precip) if month_str in ts and p is not None]

        avg_temp = round(sum(month_temps)  / len(month_temps),  1) if month_temps  else 20.0
        # precipitation_sum in mm — >80mm/month ~= high rain, convert to probability 0-1
        avg_precip = sum(month_precip) / len(month_precip) if month_precip else 60.0
        rain_prob  = round(min(avg_precip / 200.0, 1.0), 2)   # 200mm = ~100% chance

        return {
            "avg_temp_c": avg_temp,
            "season":     season,
            "rain_prob":  rain_prob,
            "source":     f"Open-Meteo Climate API ({destination}, {month.title()})",
        }

    except Exception as e:
        print(info(f"{YELLOW}Weather API unavailable ({e}) — using season estimate{RESET}"))
        return {
            "avg_temp_c": 20,
            "season":     season,
            "rain_prob":  0.30,
            "source":     "fallback (API error)",
        }


# ── 3. KNOWLEDGE GRAPH ────────────────────────────────────────────────────────

KNOWLEDGE_GRAPH = {
    "male": {
        "sports": {
            "summer": {"top":"Polo shirt",         "bottom":"Athletic shorts","shoes":"Trainers",      "layer":None},
            "autumn": {"top":"Long-sleeve jersey",  "bottom":"Track pants",   "shoes":"Trainers",      "layer":"Light windbreaker"},
            "winter": {"top":"Thermal base layer",  "bottom":"Fleece joggers","shoes":"Trail shoes",   "layer":"Puffer jacket"},
            "spring": {"top":"Breathable T-shirt",  "bottom":"Athletic shorts","shoes":"Trainers",     "layer":"Light hoodie"},
        },
        "formal": {
            "summer": {"top":"Dress shirt (S/S)",  "bottom":"Chino trousers","shoes":"Loafers",       "layer":None},
            "autumn": {"top":"Dress shirt",         "bottom":"Wool trousers", "shoes":"Oxford shoes",  "layer":"Blazer"},
            "winter": {"top":"Dress shirt + tie",   "bottom":"Suit trousers", "shoes":"Oxford shoes",  "layer":"Wool overcoat"},
            "spring": {"top":"Dress shirt",         "bottom":"Chino trousers","shoes":"Derby shoes",   "layer":"Light blazer"},
        },
        "casual": {
            "summer": {"top":"T-shirt",             "bottom":"Linen shorts",  "shoes":"Sneakers",      "layer":None},
            "autumn": {"top":"Flannel shirt",        "bottom":"Dark jeans",   "shoes":"Ankle boots",   "layer":"Denim jacket"},
            "winter": {"top":"Cable-knit sweater",  "bottom":"Dark jeans",    "shoes":"Chelsea boots", "layer":"Pea coat"},
            "spring": {"top":"Linen shirt",          "bottom":"Chinos",       "shoes":"White sneakers","layer":"Light cardigan"},
        },
        "beach": {
            "summer": {"top":"Linen shirt (open)",  "bottom":"Board shorts",  "shoes":"Flip flops",    "layer":None},
            "autumn": {"top":"Henley",               "bottom":"Linen pants",  "shoes":"Sandals",       "layer":None},
            "winter": {"top":"Light sweater",        "bottom":"Casual pants", "shoes":"Loafers",       "layer":"Light jacket"},
            "spring": {"top":"Linen shirt",          "bottom":"Shorts",       "shoes":"Sandals",       "layer":None},
        },
    },
    "female": {
        "sports": {
            "summer": {"top":"Sports bra / tank",      "bottom":"Leggings or shorts","shoes":"Running shoes", "layer":None},
            "autumn": {"top":"Long-sleeve sports top", "bottom":"Full leggings",     "shoes":"Running shoes", "layer":"Light running jacket"},
            "winter": {"top":"Thermal sports top",     "bottom":"Thermal leggings",  "shoes":"Trail shoes",   "layer":"Fleece sports jacket"},
            "spring": {"top":"Sports tank",            "bottom":"Capri leggings",    "shoes":"Trainers",      "layer":"Zip hoodie"},
        },
        "formal": {
            "summer": {"top":"Sleeveless blouse",  "bottom":"Midi skirt",        "shoes":"Strappy heels","layer":None},
            "autumn": {"top":"Silk blouse",         "bottom":"Tailored trousers","shoes":"Pumps",        "layer":"Blazer"},
            "winter": {"top":"Turtleneck",          "bottom":"Wool pencil skirt","shoes":"Ankle boots",  "layer":"Wool coat"},
            "spring": {"top":"Floral blouse",       "bottom":"Tailored trousers","shoes":"Ballet flats", "layer":"Light blazer"},
        },
        "casual": {
            "summer": {"top":"Breezy cami",        "bottom":"Linen trousers",    "shoes":"Espadrilles",    "layer":None},
            "autumn": {"top":"Knit sweater",        "bottom":"Straight-leg jeans","shoes":"Ankle boots",   "layer":"Trench coat"},
            "winter": {"top":"Chunky knit",         "bottom":"Plaid trousers",   "shoes":"Knee-high boots","layer":"Long wool coat"},
            "spring": {"top":"Striped tee",         "bottom":"Mom jeans",        "shoes":"White sneakers", "layer":"Light cardigan"},
        },
        "beach": {
            "summer": {"top":"Swimsuit / bikini top","bottom":"Sarong / shorts","shoes":"Sandals",     "layer":None},
            "autumn": {"top":"Casual sundress",     "bottom":"(dress)",         "shoes":"Flat sandals","layer":"Light wrap"},
            "winter": {"top":"Knit top",            "bottom":"Linen pants",     "shoes":"Loafers",     "layer":"Light jacket"},
            "spring": {"top":"Floral sundress",     "bottom":"(dress)",         "shoes":"Sandals",     "layer":None},
        },
    },
}

def get_recommendation(gender, occasion, season):
    """
    Each argument can be a string OR a list.
    Returns a deduplicated list of {gender, occasion, season, outfit} dicts.
    """
    genders   = gender   if isinstance(gender,   list) else [gender]
    occasions = occasion if isinstance(occasion, list) else [occasion]
    seasons   = season   if isinstance(season,   list) else [season]

    seen, results = set(), []
    for g in genders:
        for o in occasions:
            for s in seasons:
                outfit = (
                    KNOWLEDGE_GRAPH
                    .get(g, KNOWLEDGE_GRAPH["male"])
                    .get(o, KNOWLEDGE_GRAPH["male"]["casual"])
                    .get(s, {"top":"T-shirt","bottom":"Jeans","shoes":"Sneakers","layer":None})
                )
                key = (outfit["top"], outfit["bottom"], outfit["shoes"])
                if key not in seen:
                    seen.add(key)
                    results.append({"gender":g,"occasion":o,"season":s,"outfit":outfit})
    return results


# ── 4. CONVERSATION STEPS ─────────────────────────────────────────────────────

STEPS = [
    {
        "key":     "gender",
        "question":"Welcome! To get started — could you tell me a bit about yourself? "
                   "For example: are you a man, a woman, or something else entirely?",
        "valid":   ["male", "female"],
    },
    {
        "key":     "destination",
        "question":"Great! Where are you thinking of going? "
                   "Feel free to describe your destination however you like.",
        "valid":   None,   # any non-null string accepted
    },
    {
        "key":     "month",
        "question":"Lovely! What time of year are you planning to go? "
                   "Any month — or even just a season — works fine.",
        "valid":   list(MONTH_TO_NUM.keys()),
    },
    {
        "key":     "occasion",
        "question":"Last one! What will you mainly be doing there? "
                   "Tell me as much or as little as you like — "
                   "a feast, a sport, sightseeing, the beach...",
        "valid":   ["sports", "formal", "casual", "beach"],
    },
]


# ── 5. NLU ───────────────────────────────────────────────────────────────────

def _ollama_chat(system, user_message):
    try:
        r = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[{"role":"system","content":system},
                      {"role":"user",  "content":user_message}],
        )
        return r["message"]["content"]
    except ollama.ResponseError as e:
        if e.status_code == 404:
            print(f"\n{RED}Model '{OLLAMA_MODEL}' not found.{RESET}")
            print(f"Run:  {YELLOW}ollama pull {OLLAMA_MODEL}{RESET}\n")
            sys.exit(1)
        raise


def chat_freely(user_message, step):
    """LLM responds naturally to off-topic message then redirects."""
    system = (
        "You are a friendly travel outfit advisor. "
        "The user said something off-topic. "
        "Respond warmly in 1-2 sentences, then steer back to outfit advice. "
        "Keep it short and light."
    )
    reply = _ollama_chat(system, user_message).strip()
    print(); print(agent(reply))
    print(); print(agent(step["question"]))


def analyse_reply(step, user_message, all_steps):
    """
    One LLM call that:
      1. Scans the message for ANY of the four fields
      2. Classifies the reply as: value / refusal / wrongslot / offtopic

    Refusal detection covers:
      - explicit refusal  ("I don't want to say")
      - genuine ignorance ("I don't know", "not sure")
      - blanket acceptance ("any is fine", "all seasons ok", "doesn't matter")
      - vague non-answers ("this year", "sometime")

    Returns:
      { kind, value, message, stash }
    """
    valid_hint = (
        f"Valid values for '{step['key']}': {', '.join(step['valid'])}.\n"
        if step.get("valid") else
        f"'{step['key']}' expects a place name (free text).\n"
    )
    fields_list = "\n".join(
        f"  - {s['key']}: {', '.join(s['valid']) if s.get('valid') else 'free text place name'}"
        for s in all_steps
    )

    system = f"""You are a reply analyser for a travel outfit chatbot.
The agent just asked about: {step['key']}
{valid_hint}
All four fields we need:
{fields_list}

Scan the user reply for ANY of these four fields, then classify it.
Return ONLY a raw JSON object — no markdown, no explanation.

Classification rules:

(A) value — reply directly answers {step['key']}:
{{"kind":"value","value":"<extracted>","message":null,"stash":{{<other fields found>}}}}

(B) refusal — any of these patterns for {step['key']}:
  - explicit refusal: "don't want to say", "private", "none of your business"
  - genuine ignorance: "don't know", "not sure", "no idea"  
  - blanket acceptance: "any is fine", "all ok", "doesn't matter", "whatever"
  - vague non-answer: "this year" for month, "somewhere" for destination
  → {{"kind":"refusal","value":null,"message":"<one warm sentence>","stash":{{<other fields found>}}}}

(C) wrongslot — reply gives info for another field but NOT {step['key']}:
  → {{"kind":"wrongslot","value":null,"message":"<one warm sentence noting what you found>","stash":{{<the fields found>}}}}

(D) offtopic — no useful info at all, pure chitchat or tangent:
  → {{"kind":"offtopic","value":null,"message":"<one warm sentence>","stash":{{}}}}

Extraction rules:

GENDER — "male" or "female" only.
  male: man, boy, he, him, guy, gentleman, sir, male, gent
  female: woman, girl, she, her, lady, madam, female

DESTINATION — any country, city, region, or place name. Lowercase. Keep spelling as-is.
  "SG" or "sg" = singapore. "UK" = united kingdom. "US" or "USA" = usa.
  Abbreviations and nicknames count. Even if misspelled, extract it.

MONTH — full lowercase English month name (january through december).
  Map seasons directly: summer->july, winter->january, spring->april, autumn->october.
  "apr" or "APR" = april. "feb" = february. Short forms are fine.
  REFUSAL (not a month): "this year", "next year", "anytime", "soon", "whenever"

OCCASION — Map ANY human activity to one or more of: sports, formal, casual, beach.
  The user may mention MULTIPLE occasions — extract ALL of them as a comma-separated value.

  SPORTS (any physical exertion, outdoor work, manual labour):
    golf, tennis, badminton, ping pong, table tennis, running, gym, yoga, hiking, cycling,
    swimming, football, basketball, any sport,
    on-site work, fieldwork, construction, moving things, carrying, lifting, bricklaying,
    moving bricks, manual work, outdoor labour, site work, renovation, building work,
    physical job, farm work, gardening, warehouse work

  FORMAL (business, social ceremonies, dining):
    business meeting, office work, conference, interview, presentation,
    wedding, gala, ceremony, banquet, feast, formal dinner, fine dining,
    eating out, restaurant, lunch meeting, client dinner

  BEACH (water, sun, resort):
    beach, seaside, pool, resort, snorkelling, surfing, diving, sunbathing, cruise

  CASUAL (everything else — sightseeing, leisure, tourism, general travel):
    sightseeing, shopping, walking around, tourism, exploring, visiting friends,
    theme park, museum, city tour, casual outing, day trip, anything not listed above

  CRITICAL RULES FOR OCCASION:
  - If user mentions ANY activity, you MUST return a value — never offtopic/refusal.
  - If user mentions MULTIPLE activities of different types, return ALL as comma-separated.
    e.g. "join feast and sports" -> "formal, sports"
    e.g. "go to beach and sightsee" -> "beach, casual"
    e.g. "business trip and golf" -> "formal, sports"
    e.g. "just visiting" -> "casual"
    e.g. "play pingpong" -> "sports"
    e.g. "not sure" -> refusal
  - When in doubt, map to "casual".

IMPORTANT:
- stash must only contain fields OTHER than {step['key']}.
- Be GENEROUS with stash — if a field appears anywhere in the message, stash it.
- For occasion specifically: activity words always = value, never offtopic.
"""
    raw   = _ollama_chat(system, user_message)
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    # Greedy match to capture nested braces in stash
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if not match:
        return {"kind":"offtopic","value":None,"message":None,"stash":{}}

    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        return {"kind":"offtopic","value":None,"message":None,"stash":{}}

    kind  = data.get("kind", "offtopic")
    value = data.get("value")
    stash = {k: str(v).strip().lower()
             for k, v in data.get("stash", {}).items() if v}

    # Validate and normalise extracted value
    MONTH_ABBR = {
        "jan":"january","feb":"february","mar":"march","apr":"april",
        "may":"may","jun":"june","jul":"july","aug":"august",
        "sep":"september","oct":"october","nov":"november","dec":"december",
    }
    if kind == "value" and value:
        raw_value = str(value).strip().lower()
        valid = step.get("valid")

        if step["key"] == "month":
            # Normalise abbreviations
            value = MONTH_ABBR.get(raw_value[:3], raw_value)
            if valid and value not in valid:
                kind = "wrongslot"; value = None

        elif step["key"] == "occasion":
            # May be comma-separated multi-occasion: "formal, sports"
            parts = [p.strip() for p in re.split(r",|\band\b", raw_value, flags=re.IGNORECASE)
                     if p.strip()]
            valid_parts = [p for p in parts if not valid or p in valid]
            if not valid_parts:
                kind = "wrongslot"; value = None
            elif len(valid_parts) == 1:
                value = valid_parts[0]           # single string
            else:
                value = ", ".join(valid_parts)   # comma-joined multi string

        else:
            if valid and raw_value not in valid:
                kind = "wrongslot"; value = None
            else:
                value = raw_value
    else:
        value = None

    # Validate stashed values — normalise month abbreviations before checking
    MONTH_ABBR = {
        "jan":"january","feb":"february","mar":"march","apr":"april",
        "may":"may","jun":"june","jul":"july","aug":"august",
        "sep":"september","oct":"october","nov":"november","dec":"december",
    }
    valid_stash = {}
    step_map = {s["key"]: s for s in all_steps}
    for k, v in stash.items():
        s = step_map.get(k)
        if not s or k == step["key"]:
            continue
        if not v or v in ("null", "none"):
            continue
        # Normalise month abbreviations
        if k == "month":
            v = MONTH_ABBR.get(v[:3], v)
        if s.get("valid") and v not in s["valid"]:
            continue
        valid_stash[k] = v

    return {
        "kind":    kind,
        "value":   value,
        "message": data.get("message"),
        "stash":   valid_stash,
    }


# ── 6. CONVERSATION LOOP ──────────────────────────────────────────────────────

def collect_all_answers(steps):
    """
    Asks each question and routes replies:
      value     -> save, move on
      refusal   -> save broadcast list (ALL_GENDERS / ALL_SEASONS / ALL_OCCASIONS), move on
      wrongslot -> stash found fields, re-ask (no attempt counted)
      offtopic  -> chat freely, re-ask (no attempt counted)
    After 3 genuine extraction failures -> use broadcast default (same as refusal).
    Returns (answers, history) where history is a list of (agent_question, user_reply) pairs.
    """
    answers = {}
    stash   = {}   # pre-filled values from earlier wrong-slot replies
    history = []   # full conversation log: [(agent_q, user_reply), ...]

    for step in steps:
        key = step["key"]

        # ── Pre-filled from stash? Skip question ──────────────────────────────
        if key in stash:
            answers[key] = stash.pop(key)
            print()
            print(agent(step["question"]))
            print(info(f"(Already noted from your earlier reply: {YELLOW}{answers[key]}{RESET})"))
            continue

        # ── Ask question ──────────────────────────────────────────────────────
        print()
        print(agent(step["question"]))

        attempts = 0   # counts only genuine extraction failures
        while True:
            raw = input(user_prompt()).strip()
            if not raw:
                print(f"  {RED}(Please type something){RESET}")
                continue

            history.append((step["question"], raw))
            print(info(f"Processing with {OLLAMA_MODEL}..."))
            result = analyse_reply(step, raw, steps)

            # Always absorb stash finds (even from refusals/wrongslots)
            for k, v in result["stash"].items():
                if k not in answers and k not in stash:
                    stash[k] = v
                    print(info(f"Noted for later -> {YELLOW}{k} = {v}{RESET}"))

            kind = result["kind"]
            msg  = result["message"] or ""

            # ── value: save and move on ───────────────────────────────────────
            if kind == "value":
                print(info(f"Understood -> {YELLOW}{result['value']}{RESET}"))
                answers[key] = result["value"]
                break

            # ── refusal: broadcast all values, move on ────────────────────────
            if kind == "refusal":
                broadcast, ack_msg = REFUSAL_DEFAULTS[key]
                print()
                if msg:
                    print(agent(msg))
                print(agent(f"{ack_msg} Moving on!"))
                answers[key] = broadcast   # store the LIST
                break

            # ── wrongslot: stash was already absorbed above, re-ask ───────────
            if kind == "wrongslot":
                print()
                if msg:
                    print(agent(msg))
                print(agent(step["question"]))
                continue   # don't count as a failed attempt

            # ── offtopic: respond naturally, re-ask ───────────────────────────
            if msg:
                print(); print(agent(msg))
            chat_freely(raw, step)
            attempts += 1

            # 3 offtopic/failed attempts → treat same as refusal
            if attempts >= 3:
                broadcast, ack_msg = REFUSAL_DEFAULTS[key]
                print(f"  {YELLOW}Moving on with a broad recommendation.{RESET}")
                answers[key] = broadcast
                break

    return answers, history



# ── 7. FINAL RECONCILIATION ───────────────────────────────────────────────────

def final_reconcile(draft_answers, history, steps):
    """
    After the conversation ends, do one final LLM pass over the ENTIRE
    conversation transcript to catch and correct any extraction mistakes:
      - month value stored as destination ("june" as a place)
      - single-word answers that were missed mid-conversation
      - any field that still holds a broadcast list but a real answer exists

    Returns a corrected answers dict. Fields confirmed as refused (no real
    answer found anywhere) keep their broadcast list unchanged.
    """
    # Build a readable transcript
    transcript_lines = []
    for q, r in history:
        transcript_lines.append(f"Agent: {q}")
        transcript_lines.append(f"User:  {r}")
    transcript = "\n".join(transcript_lines)

    # Summarise what the step-by-step extraction found
    draft_summary = json.dumps(
        {k: v if isinstance(v, str) else "<all values — user refused>" 
         for k, v in draft_answers.items()},
        indent=2
    )

    valid_months    = list(MONTH_TO_NUM.keys())
    valid_occasions = ["sports", "formal", "casual", "beach"]
    valid_genders   = ["male", "female"]

    system = f"""You are a careful data reviewer for a travel outfit recommendation chatbot.
You have the full conversation transcript and a draft JSON extracted step-by-step.
Your job: produce the FINAL corrected JSON by reading the WHOLE conversation.

Rules:
1. Read every user message for clues — not just the one that answered each question.
2. Fix obvious errors in the draft (e.g. destination="june" is clearly a month, not a place).
3. If a field was marked <all values> but the user DID mention something relevant anywhere
   in the conversation, extract the real value.
4. If a field is genuinely unknown/refused everywhere in the conversation, keep it as null.
5. For occasion — if the user mentioned ANY activity anywhere, map it to one of:
   sports / formal / casual / beach. See rules:
   - sports: any physical activity, manual labour, on-site work, construction, sport
   - formal: business, dining, ceremony, feast, wedding
   - beach: seaside, pool, resort
   - casual: everything else, sightseeing, tourism, shopping, general travel

Valid values:
- gender: {valid_genders}
- month: {valid_months}
- occasion: {valid_occasions}
- destination: any place name (free text, keep as-is)

Return ONLY a raw JSON object — no markdown, no explanation:
{{
  "gender":      "male" | "female" | null,
  "destination": "<place>" or "<place1>, <place2>" for multiple | null,
  "month":       "<month>" or "<month1>, <month2>" for multiple | null,
  "occasion":    "sports" | "formal" | "casual" | "beach" | null
}}

IMPORTANT: If the user mentioned multiple destinations (e.g. "malaya and taiwan"),
return them comma-separated: "malaya, taiwan".
If the user mentioned multiple months (e.g. "April and December"),
return them comma-separated: "april, december".
Use null only if the field is truly absent from the entire conversation.
"""

    user_msg = f"""FULL CONVERSATION:
{transcript}

DRAFT JSON (step-by-step extraction, may contain errors):
{draft_summary}

Please produce the corrected final JSON."""

    print(info("Running final reconciliation pass over full conversation..."))
    raw   = _ollama_chat(system, user_msg)
    clean = re.sub(r"```(?:json)?|```", "", raw).strip()
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if not match:
        print(info(f"{YELLOW}Reconciliation parse failed — keeping draft answers{RESET}"))
        return draft_answers

    try:
        corrected = json.loads(match.group())
    except json.JSONDecodeError:
        print(info(f"{YELLOW}Reconciliation JSON invalid — keeping draft answers{RESET}"))
        return draft_answers

    # Merge: use corrected value if present, else fall back to draft
    final = dict(draft_answers)
    MONTH_ABBR = {
        "jan":"january","feb":"february","mar":"march","apr":"april",
        "may":"may","jun":"june","jul":"july","aug":"august",
        "sep":"september","oct":"october","nov":"november","dec":"december",
    }
    step_valids = {s["key"]: s.get("valid") for s in steps}

    for key, corrected_val in corrected.items():
        if corrected_val is None or str(corrected_val).lower() in ("null","none",""):
            continue   # truly unknown — keep whatever we have

        raw_val = str(corrected_val).strip().lower()

        # Handle comma-separated multi-values (destination / month)
        parts = [p.strip() for p in re.split(r",|\band\b", raw_val, flags=re.IGNORECASE)
                 if p.strip() and p.strip() not in ("null","none","")]

        valid_list = step_valids.get(key)

        if key == "month":
            # Normalise each part
            normed = [MONTH_ABBR.get(p[:3], p) for p in parts]
            parts  = [p for p in normed if not valid_list or p in valid_list]
        elif valid_list:
            parts = [p for p in parts if p in valid_list]

        if not parts:
            continue   # nothing valid survived

        # Store as single string if one value, list if multiple
        final_val = parts[0] if len(parts) == 1 else parts

        if final.get(key) != final_val:
            old = final.get(key)
            old_display = ", ".join(old) if isinstance(old, list) else (old or "<all>")
            new_display = ", ".join(final_val) if isinstance(final_val, list) else final_val
            print(info(f"Reconciled {key}: {YELLOW}{old_display}{RESET} -> {YELLOW}{new_display}{RESET}"))
        final[key] = final_val

    return final

# ── 8. MAIN ───────────────────────────────────────────────────────────────────

def run_agent():
    print()
    print(f"{MAGENTA}{'=' * 54}{RESET}")
    print(f"{MAGENTA}{BOLD}  StyleAdvisor  —  Outfit Recommendation Agent{RESET}")
    print(f"{MAGENTA}  Powered by Ollama ({OLLAMA_MODEL})  — runs 100% locally{RESET}")
    print(f"{MAGENTA}{'=' * 54}{RESET}")

    try:
        models = [m["model"] for m in ollama.list()["models"]]
    except Exception:
        print(f"\n{RED}Cannot reach Ollama. Is it running?{RESET}")
        print(f"Start it with:  {YELLOW}ollama serve{RESET}")
        sys.exit(1)

    if not any(OLLAMA_MODEL in m for m in models):
        print(f"\n{YELLOW}Pulling '{OLLAMA_MODEL}' — takes a few minutes first time...{RESET}\n")
        ollama.pull(OLLAMA_MODEL)
        print(f"{GREEN}Model ready.{RESET}\n")

    # ── Collect answers ───────────────────────────────────────────────────────
    draft_answers, history = collect_all_answers(STEPS)

    # ── Final reconciliation: re-read full conversation to fix any mistakes ───
    print(); print(divider())
    answers = final_reconcile(draft_answers, history, STEPS)

    # ── Normalise destination + month into lists ─────────────────────────────
    # answers may hold: a single string, a comma-joined multi string, or a list
    def to_list(val):
        """Always return a list of clean lowercase strings."""
        if isinstance(val, list):
            return [v.strip().lower() for v in val if v.strip()]
        # Split on commas or " and " to handle "malaya and taiwan"
        parts = re.split(r",|\band\b", str(val), flags=re.IGNORECASE)
        return [p.strip().lower() for p in parts if p.strip()]

    destinations = to_list(answers["destination"])
    months       = to_list(answers["month"])
    occasions    = to_list(answers["occasion"])
    genders      = to_list(answers["gender"])

    # ── Weather lookup for every (destination, month) pair ────────────────────
    print(); print(divider())
    combos = []   # list of dicts: {destination, month, weather}

    for dest in destinations:
        for month in months:
            print(info(f"Weather: {dest.title()}  /  {month.title()}  (Open-Meteo)..."))
            w = get_weather(dest, month)
            print(info(
                f"  Avg {w['avg_temp_c']}°C  |  Season: {w['season']}  |  "
                f"Rain: {int(w['rain_prob']*100)}%  |  {w['source']}"
            ))
            combos.append({"destination": dest, "month": month, "weather": w})

    # ── Build one KG JSON per (dest × month × gender × occasion) combo ─────────
    # Total combos = destinations × months × genders × occasions
    kg_inputs = []
    for combo in combos:
        w = combo["weather"]
        for gender in genders:
            for occasion in occasions:
                kg_inputs.append({
                    "gender":      gender,
                    "occasion":    occasion,
                    "season":      w["season"],
                    "destination": combo["destination"],
                    "month":       combo["month"],
                    "avg_temp_c":  w["avg_temp_c"],
                    "rain_prob":   w["rain_prob"],
                })

    # ── Print all KG JSONs ────────────────────────────────────────────────────
    print(); print(divider())
    print(f"{BOLD}  Structured JSON(s)  ->  Knowledge Graph  "
          f"({len(kg_inputs)} combination{'s' if len(kg_inputs)>1 else ''}){RESET}")
    print(divider())
    print(f"{YELLOW}{json.dumps(kg_inputs if len(kg_inputs)>1 else kg_inputs[0], indent=2)}{RESET}")

    # ── Outfit recommendations ────────────────────────────────────────────────
    print(); print(divider())
    total_outfits = 0
    outfit_blocks = []

    for kg in kg_inputs:
        recs = get_recommendation(kg["gender"], kg["occasion"], kg["season"])
        for r in recs:
            outfit_blocks.append({
                "destination": kg["destination"],
                "month":       kg["month"],
                "gender":      r["gender"],
                "occasion":    r["occasion"],
                "season":      r["season"],
                "outfit":      r["outfit"],
                "rain_prob":   kg["rain_prob"],
            })
        total_outfits += len(recs)

    print(f"{BOLD}  Outfit Recommendations  ({total_outfits} total){RESET}")

    # Group output by destination + month for readability
    from itertools import groupby
    key_fn = lambda b: (b["destination"], b["month"])
    outfit_blocks.sort(key=key_fn)

    for (dest, month), group in groupby(outfit_blocks, key=key_fn):
        print(divider())
        print(f"  {BOLD}{MAGENTA}{dest.title()}  —  {month.title()}{RESET}")
        for b in group:
            print(f"  {CYAN}{b['gender'].title()}  •  {b['occasion'].title()}  •  {b['season'].title()}{RESET}")
            o = b["outfit"]
            print(highlight("  Top",    o["top"]))
            print(highlight("  Bottom", o["bottom"]))
            print(highlight("  Shoes",  o["shoes"]))
            print(highlight("  Layer",  o["layer"] or "none needed"))
            if b["rain_prob"] > 0.40:
                print(f"    {BLUE}☂ Rain likely ({int(b['rain_prob']*100)}%) — pack an umbrella{RESET}")

    print(); print(divider())
    print(f"{DIM}  Tip: change OLLAMA_MODEL at the top to try other models.{RESET}")
    print()
    return kg_inputs


if __name__ == "__main__":
    run_agent()
