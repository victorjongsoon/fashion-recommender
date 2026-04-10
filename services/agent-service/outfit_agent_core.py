"""
outfit_agent.py  —  powered by Ollama (free, local LLM, no API key needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHITECTURE
────────────
  Phase 1  CONVERSATION  (per-question LLM: relevance + refusal only)
    For each of 5 questions:
      1. is_relevant?       YES → record, next question
      2. is_explicit_refusal? YES → record, next question (no special flag)
      3. Neither            → re-ask up to 3 times, then record and move on
    No extraction. No annotations. Just raw Q&A pairs in history.

  Phase 2  FINAL RECONCILE  (highest priority — always wins)
    One LLM reads the entire raw conversation.
    Extracts all 5 fields: gender, destination, month, occasion, budget.
    Reads holistically — finds info regardless of which question it appeared under.
    Returns the definitive answer for every field.

  Phase 3  DEFAULTS  (only fills nulls from reconcile)
    gender null → ALL_GENDERS  |  destination null → singapore
    month null → current month  |  occasion null → ALL_OCCASIONS
    budget null → 0–500 SGD

  Phase 4  WEATHER + OUTPUT JSON
    x destinations × y months × z occasions × h budget_ranges  JSON objects.
    Same keys as original: gender, occasion, season, destination, month,
    avg_temp_c, rain_prob, budget_lower, budget_upper, budget_currency.

PRE-REQUISITES
  pip install ollama
  ollama pull gemma3
  python outfit_agent.py
"""

import sys, os, json, re, datetime, urllib.request, urllib.parse
import ollama

OLLAMA_MODEL = "gemma3:1b"

RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"
RED="\033[31m";  MAGENTA="\033[35m"; BLUE="\033[34m"

def agent(msg):    return f"{CYAN}{BOLD}Agent:{RESET} {msg}"
def user_prompt(): return f"{GREEN}{BOLD}You:  {RESET}"
def info(msg):     return f"{DIM}  -> {msg}{RESET}"
def divider():     return f"{DIM}{'─'*54}{RESET}"


# ═══════════════════════════════════════════════════════════════════════════════
# 1.  DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════════

ALL_GENDERS   = ["male","female"]
ALL_OCCASIONS = ["sports","formal","casual","beach"]
MONTH_TO_NUM  = {m:i for i,m in enumerate(
    ["january","february","march","april","may","june",
     "july","august","september","october","november","december"],1)}
MONTH_ABBR    = {"jan":"january","feb":"february","mar":"march","apr":"april",
                 "may":"may","jun":"june","jul":"july","aug":"august",
                 "sep":"september","oct":"october","nov":"november","dec":"december"}

DEFAULT_DESTINATION = "singapore"
DEFAULT_MONTH       = datetime.date.today().strftime("%B").lower()
DEFAULT_BUDGET      = [{"upper":500,"currency":"SGD"}]

REFUSAL_ACK = {
    "gender":          "No problem — I'll show outfits for all styles.",
    "destination":     "No worries — I'll default to Singapore.",
    "month":           f"No worries — I'll use this month ({DEFAULT_MONTH.title()}).",
    "occasion":        "Got it — I'll cover every occasion type.",
    "budget":          "No problem — I'll keep the budget wide open (0–500 SGD).",
    "colours_liked":   "No problem — I'll show a variety of colours.",
    "colours_disliked":"Got it — no colour restrictions.",
    "num_outfits":     "I'll show you 3 outfits.",
}


# ═══════════════════════════════════════════════════════════════════════════════
# 2.  WEATHER
# ═══════════════════════════════════════════════════════════════════════════════

def _season(n):
    if n in (3,4,5):   return "spring"
    if n in (6,7,8):   return "summer"
    if n in (9,10,11): return "autumn"
    return "winter"

def _fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())

def _geocode_raw(place):
    q   = urllib.parse.quote(place)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1&language=en&format=json"
    try:
        res = _fetch_json(url).get("results",[])
        if res: return res[0]["latitude"], res[0]["longitude"], res[0].get("name", place)
    except Exception: pass
    return None, None, place

def _normalise_place(place):
    system = (
        "You are a geography expert. Convert the given place name to the standard "
        "modern English name for a geocoding API. "
        "Fix misspellings (Singaspre→Singapore). "
        "Use modern names for historical ones (Temasek→Singapore, Malaya→Malaysia, "
        "Siam→Thailand, Cathay→China, Persia→Iran, Ceylon→Sri Lanka). "
        "Pick a representative city for vague regions (Central Africa→Kinshasa). "
        "Expand abbreviations (SG→Singapore, UK→United Kingdom). "
        "Real modern place names (Turkistan, Kinmen, etc.): return unchanged. "
        "Return ONLY the place name."
    )
    result = _ollama_chat(system, place).strip()
    return result.strip('.,!?\'"')

def _geocode(place):
    lat, lon, resolved = _geocode_raw(place)
    if lat is not None: return lat, lon, resolved
    print(info(f"{YELLOW}'{place}' not found — normalising...{RESET}"))
    normed = _normalise_place(place)
    if normed.lower() != place.lower():
        print(info(f"  {place} → {YELLOW}{normed}{RESET}"))
        lat, lon, resolved = _geocode_raw(normed)
        if lat is not None: return lat, lon, resolved
    print(info(f"{RED}Cannot geocode '{place}' — using season estimate{RESET}"))
    return None, None, place

WEATHER_SERVICE_URL = os.environ.get("WEATHER_SERVICE_URL", "http://localhost:8005")

def get_weather(destination, month):
    """Call the weather-service for destination + month data."""
    mon_num = next((v for k,v in MONTH_TO_NUM.items() if k.startswith(month[:3])), 3)
    season  = _season(mon_num)
    try:
        q_dest  = urllib.parse.quote(destination)
        q_month = urllib.parse.quote(month)
        url = f"{WEATHER_SERVICE_URL}/weather?destination={q_dest}&month={q_month}"
        return _fetch_json(url)
    except Exception as e:
        print(info(f"{YELLOW}Weather service error ({e}) — season estimate{RESET}"))
        return {"avg_temp_c":20,"season":season,"rain_prob":0.30,"source":"fallback"}


# ═══════════════════════════════════════════════════════════════════════════════
# 3.  BUDGET PARSER
# ═══════════════════════════════════════════════════════════════════════════════

def parse_budget_ranges(text):
    cm = re.search(r'(?:^|\W)(SGD|USD|EUR|GBP|MYR|JPY|AUD|CNY|HKD|TWD)(?=\W|$)',
                   text, re.IGNORECASE)
    currency = cm.group(1).upper() if cm else "SGD"
    matches  = re.compile(r'(\d[\d,]*)\s*(?:-+|\bto\b|~|–|—)\s*(\d[\d,]*)',
                          re.IGNORECASE).findall(text)
    if not matches: return None
    out = []
    for lo_s, hi_s in matches:
        lo,hi = int(lo_s.replace(',','')), int(hi_s.replace(',',''))
        if lo > hi: lo,hi = hi,lo
        out.append({"lower":lo,"upper":hi,"currency":currency})
    return out or None


# ═══════════════════════════════════════════════════════════════════════════════
# 5.  LLM HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _ollama_chat(system, user_message):
    try:
        r = ollama.chat(model=OLLAMA_MODEL,
                        messages=[{"role":"system","content":system},
                                  {"role":"user","content":user_message}])
        return r["message"]["content"]
    except ollama.ResponseError as e:
        if e.status_code == 404:
            print(f"\n{RED}Model '{OLLAMA_MODEL}' not found. Run: ollama pull {OLLAMA_MODEL}{RESET}\n")
            sys.exit(1)
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# 6.  CONVERSATION STEPS
# ═══════════════════════════════════════════════════════════════════════════════

STEPS = [
    {"key":"gender",
     "question":"Welcome! To get started — are you a man, a woman, or something else?",
     "hint":"e.g. 'I am a man', 'female', 'she/her'"},
    {"key":"destination",
     "question":"Great! Where are you thinking of going? You can name multiple places.",
     "hint":"e.g. 'Japan', 'Paris and Rome', 'Southeast Asia'"},
    {"key":"month",
     "question":"Lovely! What time of year are you planning to go? Multiple months are fine.",
     "hint":"e.g. 'March', 'June and December', 'summer'"},
    {"key":"occasion",
     "question":"What will you mainly be doing there? Feel free to list several.",
     "hint":"e.g. 'formal dinner', 'hiking', 'sightseeing and beach'"},
    {"key":"budget",
     "question":"What is your maximum outfit budget? Just give one number.",
     "hint":"e.g. '200', '500 SGD', 'no limit'"},
    {"key":"colours_liked",
     "question":"Any colours you love? I'll prioritise these in your outfits.",
     "hint":"e.g. 'Black and Dark Blue', 'I like White', or say 'no preference'"},
    {"key":"colours_disliked",
     "question":"Last one! Any colours you want to avoid?",
     "hint":"e.g. 'No Red or Yellow', 'avoid Orange', or say 'none'"},
    {"key":"num_outfits",
     "question":"How many outfit combinations would you like? (1 to 5)",
     "hint":"e.g. '3', 'give me 5', 'just one'"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# 7.  PER-QUESTION LLM FUNCTIONS
#     Single responsibility: relevance detection + refusal detection only.
#     No extraction. No value assignment.
# ═══════════════════════════════════════════════════════════════════════════════

# Relevance: is this reply about the current question's topic?
_CLASSIFY_TOPICS = {
    "gender":          "the user's gender (man, woman, male, female, he/him, she/her, etc.)",
    "destination":     "a travel destination — any country, city, region, or place name",
    "month":           "a time of year — any month name, season, or travel date",
    "occasion":        (
        "an activity or occasion they plan to do. This includes: "
        "sports / gym / hiking / running / golf (→ sports); "
        "feast / banquet / dinner / dining / wedding / ceremony / business / meeting (→ formal); "
        "beach / pool / resort / surfing (→ beach); "
        "sightseeing / shopping / exploring / tourism (→ casual). "
        "Any of these words, or similar activities, count as RELEVANT."
    ),
    "budget":          (
        "a clothing budget — any number, currency, or range. "
        "A bare number like '500' or '200' IS a budget answer and is RELEVANT. "
        "Examples of RELEVANT: '500', '200 SGD', '100 to 300', 'no limit', 'any budget'."
    ),
    "colours_liked":   (
        "colours the user likes OR a deliberate statement of having no colour preference. "
        "'no preference', 'any colour', 'doesn't matter', 'no specific colour', 'neutral', "
        "'I don't mind' — these are all RELEVANT answers, not refusals."
    ),
    "colours_disliked":(
        "colours the user wants to avoid OR a deliberate statement of having no colour restrictions. "
        "'none', 'no preference', 'any', 'I don't mind', 'no restriction' — these are all RELEVANT answers."
    ),
    "num_outfits":     "a number (1 to 5) for how many outfit combinations the user wants",
}

_CLASSIFY_SYSTEM = """You classify a user's reply into exactly ONE of three categories, given the TOPIC of the question asked.

TOPIC: {topic}

CATEGORIES:
  RELEVANT        — The reply meaningfully addresses the topic, even indirectly.
                    This includes partial answers, synonyms, and deliberate "no preference" / "none" statements.
                    A "no preference" or "I don't mind" answer IS relevant — it tells us the user has no constraint.
  EXPLICIT_REFUSE — The user is clearly and deliberately refusing to answer.
                    Only applies to: 'refuse', 'skip', 'none of your business', 'I don't want to say',
                    profanity used as pure dismissal (fuck off, shit, 滚, etc.), '无可奉告', '不说', '不想说'.
                    A "no preference" answer is NOT an explicit refusal — it is RELEVANT.
  IMPLICIT_REFUSE — The reply is off-topic noise with no useful content for this topic, and is NOT a deliberate refusal.
                    e.g. answering the destination question with a budget number, or staying silent.

Examples when TOPIC is BUDGET:
  "500"                         → RELEVANT   (bare number = maximum budget)
  "200 SGD"                     → RELEVANT
  "100 to 300"                  → RELEVANT
  "no limit"                    → RELEVANT
  "refuse"                      → EXPLICIT_REFUSE
  "I want to go to Japan"       → IMPLICIT_REFUSE  (off-topic)

Examples when TOPIC is COLOURS_LIKED:
  "I like blue and white"       → RELEVANT
  "no preference"               → RELEVANT   (deliberate answer: no colour constraint)
  "any colour is fine"          → RELEVANT   (deliberate answer: no colour constraint)
  "I don't mind"                → RELEVANT   (deliberate answer: no colour constraint)
  "refuse"                      → EXPLICIT_REFUSE
  "I want to go to Japan"       → IMPLICIT_REFUSE  (off-topic, not about colours)

Examples when TOPIC is OCCASION:
  "feast and sports"            → RELEVANT   (feast = formal dining, sports = physical activity)
  "I will be attending a banquet and also hiking" → RELEVANT
  "just casual sightseeing"     → RELEVANT
  "my budget is 500"            → IMPLICIT_REFUSE  (off-topic)
  "skip"                        → EXPLICIT_REFUSE

Examples when TOPIC is DESTINATION:
  "Japan"                       → RELEVANT
  "I will go to Malaya"         → RELEVANT
  "my budget is 100-200"        → IMPLICIT_REFUSE
  "refuse, wait! Tokyo"         → RELEVANT   (corrected themselves, contains destination)
  "fuck you"                    → EXPLICIT_REFUSE

Examples when TOPIC is GENDER:
  "I am a man"                  → RELEVANT
  "male"                        → RELEVANT
  "I plan to go to Japan"       → IMPLICIT_REFUSE  (destination, not gender)

Examples when TOPIC is MONTH:
  "June and December"           → RELEVANT
  "dec and june"                → RELEVANT
  "my budget is 200-300"        → IMPLICIT_REFUSE
  "I am female"                 → IMPLICIT_REFUSE

Reply with ONLY one word: RELEVANT  or  EXPLICIT_REFUSE  or  IMPLICIT_REFUSE"""


# RESULT constants
_R_RELEVANT        = "relevant"
_R_EXPLICIT_REFUSE = "explicit_refuse"
_R_IMPLICIT_REFUSE = "implicit_refuse"

def classify_reply(step_key, reply):
    """
    Single LLM call that returns one of:
      _R_RELEVANT, _R_EXPLICIT_REFUSE, _R_IMPLICIT_REFUSE
    Replaces the old is_relevant() + is_explicit_refusal() two-call approach.
    """
    topic  = _CLASSIFY_TOPICS[step_key]
    system = _CLASSIFY_SYSTEM.replace("{topic}", topic)
    raw    = _ollama_chat(system, f"User said: {reply}").strip().upper()
    if raw.startswith("EXPLICIT"):
        return _R_EXPLICIT_REFUSE
    if raw.startswith("RELEVANT"):
        return _R_RELEVANT
    return _R_IMPLICIT_REFUSE  # IMPLICIT_REFUSE or anything unexpected → re-ask


# ═══════════════════════════════════════════════════════════════════════════════
# 8.  PHASE 1 — CONVERSATION
#     Each question: relevant → accept | refusal → accept + ack | else → re-ask ×3
#     History = plain raw Q&A pairs. No flags. No annotations. No extraction.
# ═══════════════════════════════════════════════════════════════════════════════

def collect_conversation():
    """
    Returns history: list of {"question": str, "answer": str}
    Clean and simple — just what was said, nothing more.
    """
    MAX = 3
    history = []

    for step in STEPS:
        key = step["key"]
        print(); print(agent(step["question"]))
        attempts = 0

        while True:
            raw = input(user_prompt()).strip()
            if not raw:
                print(f"  {RED}(Please type something — or say 'refuse' to skip){RESET}")
                continue

            print(info("Checking..."))

            # ALWAYS record every reply — reconcile needs the full picture,
            # including cross-slot answers given under the wrong question.
            history.append({"question": step["question"], "answer": raw})

            verdict = classify_reply(key, raw)

            # ── Relevant → move on ────────────────────────────────────────────
            if verdict == _R_RELEVANT:
                print(info("Got it."))
                break

            # ── Explicit refusal → acknowledge and move on ────────────────────
            if verdict == _R_EXPLICIT_REFUSE:
                print(info(f"{YELLOW}OK, skipping this one.{RESET}"))
                print(agent(REFUSAL_ACK[key]))
                break

            # ── Implicit refusal / off-topic → re-ask up to MAX times ─────────
            attempts += 1
            if attempts >= MAX:
                print(info(f"{YELLOW}Moving on.{RESET}"))
                break

            remaining = MAX - attempts
            s = "s" if remaining > 1 else ""
            print(); print(agent(
                f"I didn't quite catch that. Could you try again? "
                f"({remaining} attempt{s} left)\n"
                f"  {step['question']}\n"
                f"  {DIM}Hint: {step['hint']}{RESET}\n"
                f"  {DIM}Or say 'refuse' / '无可奉告' to skip.{RESET}"
            ))

    return history


# ═══════════════════════════════════════════════════════════════════════════════
# 9.  PHASE 2 — FINAL RECONCILE  (highest priority — always wins)
#     Reads plain raw history. No tags. No labels. Extracts everything.
# ═══════════════════════════════════════════════════════════════════════════════

def final_reconcile(history):
    """
    Single LLM call over the plain raw conversation.
    Returns dict with keys: gender, destination, month, occasion, budget,
                            colours_liked, colours_disliked
    Null = field genuinely absent → Phase 3 applies smart default.
    """
    transcript = "\n".join(
        f"Agent: {h['question']}\nUser:  {h['answer']}"
        for h in history
    )

    valid_months = list(MONTH_TO_NUM.keys())

    system = f"""You are the final data extractor for a travel outfit chatbot.
Read the ENTIRE conversation and extract exactly 7 fields.
Your output is the highest-priority result — it overrides all defaults.

━━━ RULE 1 — READ HOLISTICALLY ━━━
The user may have answered questions out of order or under the wrong question.
Extract information from ANY turn regardless of which question was being asked.
Example: user says "I plan to go malaya" when asked about gender → destination = malaya

━━━ RULE 2 — MIND-CHANGE: MOST RECENT WINS ━━━
If the user corrects themselves, use the MOST RECENT value only.
  "formal one! Oh! SPORTS ONE" → sports
  "I am male... wait, female" → female
  "refuse, wait! Tokyo" → destination = tokyo

━━━ RULE 3 — REFUSAL MEANS NULL ━━━
If the user said "refuse", "skip", "fuck", "shit" or similar dismissal
for a field AND gave no real answer for that field anywhere in the conversation,
return null for that field.
But if they said the dismissal AND also mentioned the field elsewhere → extract it.

━━━ RULE 4 — NEVER HALLUCINATE ━━━
Only extract values LITERALLY present in the transcript.
If a field is absent or unclear → null. Never guess or invent.

━━━ RULE 5 — NO PREFERENCE IS A VALID ANSWER ━━━
"no preference", "any colour", "doesn't matter", "no restriction" etc.
are VALID answers, not refusals. For colours_liked/colours_disliked,
store them as the special string "no preference" (not null).
null means the question was never answered at all.

FIELD RULES:

GENDER → "male" or "female" or null
  male: man, boy, he/him, guy, sir, gent
  female: woman, girl, she/her, lady, madam

DESTINATION → place name(s) literally mentioned, or null
  Comma-separate multiples: "malaya, japan"
  Never use month names as destinations: {", ".join(valid_months)}

MONTH → full lowercase month name(s) literally mentioned, or null
  Comma-separate multiples: "june, december"
  Map: dec→december, jun→june, summer→july, winter→january, spring→april, autumn→october

OCCASION → one or more of: sports / formal / casual / beach — or null
  Map user words to these FOUR values ONLY. Comma-separate multiples.
  sports:  sport, gym, running, hiking, golf, physical activity, exercise, workout, training
  formal:  feast, banquet, dinner, dining, wedding, ceremony, meeting, conference, business, gala, party, church
  beach:   beach, pool, seaside, resort, snorkelling, surfing, swimming
  casual:  sightseeing, shopping, tourism, exploring, general travel, walking around
  IMPORTANT: "feast" maps to "formal". "sports" AND "feast" → "sports, formal"
  Examples:
    "feast and sports" → "formal, sports"
    "hiking and dinner" → "sports, formal"
    "beach and sightseeing" → "beach, casual"
    "just casual" → "casual"

BUDGET → list of budget objects, or null
  The user is asked for their MAXIMUM budget, so a single number is the upper limit only.
  Single number "500" → {{"upper": 500, "currency": "SGD"}}   (no lower field)
  Range "100-200"     → {{"lower": 100, "upper": 200, "currency": "SGD"}}
  Also parse: "50 to 150", "100~200", "100-200 or 300-400" etc.
  Currency defaults to SGD. Swap reversed ranges (1000-300 → lower=300, upper=1000).
  "no limit" / "any" → null.

COLOURS_LIKED → comma-separated colour names the user likes, or "no preference", or null
  "no preference", "any colour", "doesn't matter", "no specific", "neutral" → "no preference"
  null only if the question was never answered.

COLOURS_DISLIKED → comma-separated colour names the user wants to avoid, or "no preference", or null
  "none", "no preference", "no restriction" → "no preference"
  null only if the question was never answered.

Return ONLY raw JSON — no markdown, no explanation:
{{
  "gender":           "male" | "female" | null,
  "destination":      "<place>" | "<p1>, <p2>" | null,
  "month":            "<month>" | "<m1>, <m2>" | null,
  "occasion":         "<occ>" | "<o1>, <o2>" | null,
  "budget":           [{{"upper":<int>, "currency":<str>}}] | [{{"lower":<int>,"upper":<int>,"currency":<str>}}] | null,
  "colours_liked":    "<colour(s)>" | "no preference" | null,
  "colours_disliked": "<colour(s)>" | "no preference" | null
}}"""

    print(info("Running final reconciliation..."))
    raw   = _ollama_chat(system, f"CONVERSATION:\n{transcript}\n\nExtract the 7 fields:")
    clean = re.sub(r"```(?:json)?|```","",raw).strip()
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if not match:
        print(info(f"{YELLOW}Parse failed — using all defaults{RESET}")); return {}
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        print(info(f"{YELLOW}JSON invalid — using all defaults{RESET}")); return {}
    print(info(f"Result: {YELLOW}{json.dumps(data)}{RESET}"))
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# 10. PHASE 3 — APPLY DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════════

def _to_list(val):
    if isinstance(val, list):
        return [str(v).strip().lower() for v in val if str(v).strip()]
    return [p.strip().lower() for p in re.split(r",|\band\b", str(val), flags=re.IGNORECASE)
            if p.strip()]

def apply_defaults(rec):
    out = {}
    g = rec.get("gender")
    out["gender"] = str(g).lower() if g and str(g).lower() in ("male","female") else ALL_GENDERS

    d = rec.get("destination")
    if d and str(d).lower() not in ("null","none",""):
        parts = [p for p in _to_list(d) if p not in MONTH_TO_NUM]
        out["destination"] = parts if parts else DEFAULT_DESTINATION
    else:
        out["destination"] = DEFAULT_DESTINATION

    m = rec.get("month")
    if m and str(m).lower() not in ("null","none",""):
        normed = [MONTH_ABBR.get(p[:3],p) for p in _to_list(m)]
        valid  = [p for p in normed if p in MONTH_TO_NUM]
        out["month"] = valid if valid else DEFAULT_MONTH
    else:
        out["month"] = DEFAULT_MONTH

    occ = rec.get("occasion")
    if occ and str(occ).lower() not in ("null","none",""):
        valid = [p for p in _to_list(occ) if p in ALL_OCCASIONS]
        out["occasion"] = valid if valid else ALL_OCCASIONS
    else:
        out["occasion"] = ALL_OCCASIONS

    b = rec.get("budget")
    if isinstance(b, list) and b:
        vr = [x for x in b if isinstance(x,dict) and "upper" in x]
        if vr:
            for r in vr:
                r.setdefault("currency","SGD")
                if "lower" in r and r["lower"] > r["upper"]:
                    r["lower"], r["upper"] = r["upper"], r["lower"]
            out["budget"] = vr
        else: out["budget"] = DEFAULT_BUDGET
    elif isinstance(b, str) and b.lower() not in ("null","none",""):
        out["budget"] = parse_budget_ranges(b) or DEFAULT_BUDGET
    else:
        out["budget"] = DEFAULT_BUDGET

    # Colours — "no preference" is a real value, null means not answered (use default)
    cl = rec.get("colours_liked")
    out["colours_liked"] = (
        "no preference" if cl and str(cl).strip().lower() in ("no preference","any","none","no specific","neutral","")
        else str(cl).strip() if cl and str(cl).lower() not in ("null","none")
        else "no preference"  # default
    )

    cd = rec.get("colours_disliked")
    out["colours_disliked"] = (
        "none" if cd and str(cd).strip().lower() in ("no preference","any","none","no restriction","")
        else str(cd).strip() if cd and str(cd).lower() not in ("null","none")
        else "none"  # default
    )

    return out


# ═══════════════════════════════════════════════════════════════════════════════
# 11. MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def run_agent():
    print(f"\n{MAGENTA}{'='*54}{RESET}")
    print(f"{MAGENTA}{BOLD}  StyleAdvisor  —  Outfit Recommendation Agent{RESET}")
    print(f"{MAGENTA}  Powered by Ollama ({OLLAMA_MODEL}){RESET}")
    print(f"{MAGENTA}{'='*54}{RESET}")

    try:
        models = [m["model"] for m in ollama.list()["models"]]
    except Exception:
        print(f"\n{RED}Cannot reach Ollama.{RESET} Start with: {YELLOW}ollama serve{RESET}")
        sys.exit(1)
    if not any(OLLAMA_MODEL in m for m in models):
        print(f"\n{YELLOW}Pulling '{OLLAMA_MODEL}'...{RESET}\n")
        ollama.pull(OLLAMA_MODEL); print(f"{GREEN}Ready.{RESET}\n")

    # Phase 1
    history = collect_conversation()

    # Phase 2
    print(); print(divider())
    reconciled = final_reconcile(history)

    # Phase 3
    answers = apply_defaults(reconciled)

    # Display extracted answers (includes colours for human readability)
    print(divider())
    print(f"{BOLD}  Extracted answers:{RESET}")
    for k in ["gender","destination","month","occasion","budget","colours_liked","colours_disliked"]:
        raw_val   = reconciled.get(k)
        final_val = answers[k]
        is_default = raw_val is None or str(raw_val).lower() in ("null","none","")
        if k=="budget" and isinstance(final_val,list) and final_val and isinstance(final_val[0],dict):
            parts = []
            for bv in final_val:
                cur = bv.get("currency","SGD")
                if "lower" in bv:
                    parts.append(f"{cur} {bv['lower']}-{bv['upper']}")
                else:
                    parts.append(f"{cur} max {bv['upper']}")
            disp = ", ".join(parts)
        elif isinstance(final_val,list): disp = ", ".join(str(x) for x in final_val)
        else: disp = str(final_val)
        marker = f"  {DIM}← default{RESET}" if is_default else ""
        print(f"  {BOLD}{k:<16}{RESET}{YELLOW}{disp}{RESET}{marker}")

    # Normalise
    destinations = _to_list(answers["destination"])
    months       = [MONTH_ABBR.get(m[:3],m)
                    for m in (_to_list(answers["month"]) if isinstance(answers["month"],str)
                              else [str(x) for x in answers["month"]]
                              if isinstance(answers["month"],list) else [answers["month"]])]
    months       = [m for m in months if m in MONTH_TO_NUM] or [DEFAULT_MONTH]
    occasions    = answers["occasion"] if isinstance(answers["occasion"],list) else _to_list(answers["occasion"])
    genders      = answers["gender"]   if isinstance(answers["gender"],list)   else [answers["gender"]]
    budgets      = answers["budget"]   if isinstance(answers["budget"],list)   else DEFAULT_BUDGET

    # Weather
    print(); print(divider())
    combos = []
    for dest in destinations:
        for month in months:
            print(info(f"Weather: {dest.title()} / {month.title()}..."))
            w = get_weather(dest, month)
            print(info(f"  {w['avg_temp_c']}°C  |  {w['season']}  |  Rain {int(w['rain_prob']*100)}%  |  {w['source']}"))
            combos.append({"destination":dest,"month":month,"weather":w})

    # Build output JSON (original format — no KG lookup, no outfit fields)
    output = []
    for c in combos:
        w = c["weather"]
        for g in genders:
            for o in occasions:
                for b in budgets:
                    entry = {
                        "gender":            g,
                        "occasion":          o,
                        "season":            w["season"],
                        "destination":       c["destination"],
                        "month":             c["month"],
                        "avg_temp_c":        w["avg_temp_c"],
                        "rain_prob":         w["rain_prob"],
                        "budget_upper":      b["upper"],
                        "budget_currency":   b.get("currency","SGD").lower(),
                        "colours_liked":     answers["colours_liked"],
                        "colours_disliked":  answers["colours_disliked"],
                    }
                    if "lower" in b:
                        entry["budget_lower"] = b["lower"]
                    output.append(entry)

    print(); print(divider())
    n = len(output)
    print(f"{BOLD}  Structured JSON  ({n} combination{'s' if n>1 else ''}){RESET}")
    print(divider())
    print(f"{YELLOW}{json.dumps(output if n>1 else output[0], indent=2)}{RESET}")

    print(); print(divider())
    print(f"{DIM}  Tip: change OLLAMA_MODEL at the top to try other models.{RESET}\n")
    return output

if __name__ == "__main__":
    run_agent()
