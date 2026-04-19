import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from kg.candidate_service import get_ga_candidates
from ga.genetic_algorithm import load_lift_tables, run_ga

app = FastAPI(title="Fashion Recommender Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load lift tables at startup
DATA_DIR = os.environ.get("DATA_DIR", "/data")
load_lift_tables(DATA_DIR)

RECOMMENDATION_STRATEGY = os.environ.get("RECOMMENDATION_STRATEGY", "kg_ga")
RANDOM_SEED = 42
print(f"Running RECOMMENDATION_STRATEGY = {RECOMMENDATION_STRATEGY}")

DEFAULT_MAX_PRICE = 9999


def run_kg_random(candidate_df, num_outfits):
    if candidate_df.empty:
        return []
    shuffled = candidate_df.sample(frac=1, random_state=RANDOM_SEED)
    used_tops, used_bottoms, results = set(), set(), []
    for _, row in shuffled.iterrows():
        if len(results) >= num_outfits:
            break
        top, bot = row.get("Top_Article"), row.get("Bottom_Article")
        if top in used_tops or bot in used_bottoms:
            continue
        used_tops.add(top)
        used_bottoms.add(bot)
        result = row.to_dict()
        result["fitness_score"] = 0.0
        results.append(result)
    return results


def run_kg_lift(candidate_df, num_outfits):
    if candidate_df.empty:
        return []
    sorted_df = candidate_df.sort_values("Lift_Score", ascending=False)
    used_tops, used_bottoms, results = set(), set(), []
    for _, row in sorted_df.iterrows():
        if len(results) >= num_outfits:
            break
        top, bot = row.get("Top_Article"), row.get("Bottom_Article")
        if top in used_tops or bot in used_bottoms:
            continue
        used_tops.add(top)
        used_bottoms.add(bot)
        result = row.to_dict()
        result["fitness_score"] = row["Lift_Score"]
        results.append(result)
    return results


class RecommendRequest(BaseModel):
    occasion: str
    category: str
    num_outfits: int = Field(default=3, ge=1, le=5)
    max_price: float = Field(default=100, ge=1)
    preferred_colors: list[str] = []
    avoid_colors: list[str] = []
    season: Optional[str] = None        # ← added: "spring" | "summer" | "autumn" | "winter"


class OutfitResponse(BaseModel):
    top_article_id: str
    bottom_article_id: str
    fitness_score: float
    top_color: str
    top_pattern: str
    top_type: str
    top_price: float
    bottom_color: str
    bottom_pattern: str
    bottom_type: str
    bottom_price: float
    top_stock_status: str
    top_occasion: str
    bottom_stock_status: str
    bottom_occasion: str


class RecommendResponse(BaseModel):
    outfits: list[OutfitResponse]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(request: RecommendRequest):
    max_price = request.max_price

    # Step 1: Get candidates from KG — now passing season!
    # preferred_colors is no longer a hard KG filter; it's a soft GA term.
    candidate_df = get_ga_candidates(
        category=request.category,
        avoid_colors=request.avoid_colors,
        max_price=max_price,
        occasion=request.occasion,
        season=request.season,          # ← now wired through
    )

    # Step 2: Handle empty candidate pool
    if candidate_df.empty:
        return RecommendResponse(outfits=[])

    # Step 3: Run selected strategy
    if RECOMMENDATION_STRATEGY == "kg_ga":
        results = run_ga(
            candidate_df,
            num_outfits=request.num_outfits,
            max_price=max_price,
            preferred_colors=request.preferred_colors,
        )
    elif RECOMMENDATION_STRATEGY == "kg_lift":
        results = run_kg_lift(candidate_df, num_outfits=request.num_outfits)
    elif RECOMMENDATION_STRATEGY == "kg_random":
        results = run_kg_random(candidate_df, num_outfits=request.num_outfits)
    else:
        raise ValueError(f"Invalid RECOMMENDATION_STRATEGY: {RECOMMENDATION_STRATEGY}")

    # Step 4: Format response
    outfits = []
    for result in results:
        outfits.append(OutfitResponse(
            top_article_id=str(result.get("Top_Article", "")),
            bottom_article_id=str(result.get("Bottom_Article", "")),
            fitness_score=result.get("fitness_score", 0.0),
            top_color=str(result.get("Top_Color", "")),
            top_pattern=str(result.get("Top_Pattern", "")),
            top_type=str(result.get("Top_Type", "")),
            top_price=float(result.get("Top_Price", 0.0) or 0.0),
            bottom_color=str(result.get("Bottom_Color", "")),
            bottom_pattern=str(result.get("Bottom_Pattern", "")),
            bottom_type=str(result.get("Bottom_Type", "")),
            bottom_price=float(result.get("Bottom_Price", 0.0) or 0.0),
            top_stock_status=str(result.get("Top_Stock_Status", "") or ""),
            top_occasion=str(result.get("Top_Occasion", "") or ""),
            bottom_stock_status=str(result.get("Bottom_Stock_Status", "") or ""),
            bottom_occasion=str(result.get("Bottom_Occasion", "") or ""),
        ))

    return RecommendResponse(outfits=outfits)
