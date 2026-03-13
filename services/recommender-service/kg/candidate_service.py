import os
import pandas as pd
import joblib
from neo4j import GraphDatabase

# Connect to Neo4j using environment variables
URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password123")
driver = GraphDatabase.driver(URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# Load articles DataFrame for type enrichment
DATA_DIR = os.environ.get("DATA_DIR", "/data")
_articles_joblib_path = os.path.join(DATA_DIR, "kg", "clean_articles_df.joblib")
if not os.path.exists(_articles_joblib_path):
    # Fallback: check next to this file (local dev)
    _articles_joblib_path = os.path.join(os.path.dirname(__file__), "clean_articles_df.joblib")

articles_df = None
if os.path.exists(_articles_joblib_path):
    articles_df = joblib.load(_articles_joblib_path)
    # Build a quick lookup: article_id (str) -> product_type_name
    articles_df["article_id"] = articles_df["article_id"].astype(str).str.zfill(10)
    _article_type_map = dict(zip(articles_df["article_id"], articles_df["product_type_name"]))
    print(f"Loaded articles DataFrame with {len(_article_type_map)} articles for type enrichment")
else:
    _article_type_map = {}
    print(f"WARNING: articles joblib not found at {_articles_joblib_path}")

def query_neo4j(category, preferred_colors, max_price, occasion=None, season=None, top_limit=100):
    """Helper function to query Neo4j based on the requirements."""

    # Hard Constraints (Always applied)
    # Note: max_price filters individual top price, not total outfit price.
    # The GA handles total outfit price via its price penalty term.
    query_parts = [
        "MATCH (top:Item)-[:in_category]->(cat:Attribute) WHERE toLower(cat.id) CONTAINS toLower($category)",
        "MATCH (top)-[:has_price]->(price:Attribute) WHERE toFloat(price.id) <= $max_price"
    ]

    # Color constraint: match ANY from preferred_colors list, skip if empty
    if preferred_colors:
        query_parts.append(
            "MATCH (top)-[:has_color]->(col:Attribute) WHERE col.id IN $preferred_colors"
        )

    # Soft Constraints (Applied if they aren't None)
    if occasion:
        query_parts.append("MATCH (top)-[:has_occasion]->(occ:Attribute) WHERE toLower(occ.id) = toLower($occasion)")
    if season:
        query_parts.append("MATCH (top)-[:has_season]->(sea:Attribute) WHERE toLower(sea.id) = toLower($season)")

    # Assemble the final query
    final_query = "\n".join(query_parts) + """
    WITH top LIMIT $top_limit

    // --- Transverse the Bridge ---
    MATCH (top)-[match:best_matches_with]->(bottom:Item)

    // -- Grab the extra info for the GA ---
    OPTIONAL MATCH (top)-[:has_price]->(top_price)
    OPTIONAL MATCH (top)-[:has_color]->(top_color)
    OPTIONAL MATCH (top)-[:has_pattern]->(top_pattern)
    OPTIONAL MATCH (top)-[:has_stock_status]->(top_stock)
    OPTIONAL MATCH (bottom)-[:has_price]->(bottom_price)
    OPTIONAL MATCH (bottom)-[:has_color]->(bottom_color)
    OPTIONAL MATCH (bottom)-[:has_pattern]->(bottom_pattern)
    OPTIONAL MATCH (bottom)-[:has_stock_status]->(bottom_stock)
    OPTIONAL MATCH (top)-[:has_occasion]->(top_occ)
    OPTIONAL MATCH (bottom)-[:has_occasion]->(bottom_occ)

    RETURN top.id AS Top_Article,
           bottom.id AS Bottom_Article,
           match.weight AS Lift_Score,
           toFloat(top_price.id) AS Top_Price,
           top_color.id AS Top_Color,
           top_pattern.id AS Top_Pattern,
           top_stock.id AS Top_Stock_Status,
           top_occ.id AS Top_Occasion,
           toFloat(bottom_price.id) AS Bottom_Price,
           bottom_color.id AS Bottom_Color,
           bottom_pattern.id AS Bottom_Pattern,
           bottom_stock.id AS Bottom_Stock_Status,
           bottom_occ.id AS Bottom_Occasion
    ORDER BY top.id DESC
    """

    with driver.session() as session:
        results = session.run(
            final_query,
            category=category,
            preferred_colors=preferred_colors,
            max_price=float(max_price),
            occasion=occasion,
            season=season,
            top_limit=top_limit
        )
        data = [record.data() for record in results]

    if not data:
        return pd.DataFrame(columns=["Top_Article", "Bottom_Article", "Lift_Score", "Top_Price", "Top_Color", "Top_Pattern", "Top_Stock_Status", "Top_Occasion", "Bottom_Price", "Bottom_Color", "Bottom_Pattern", "Bottom_Stock_Status", "Bottom_Occasion"])

    candidate_df = pd.DataFrame(data)
    candidate_df = candidate_df.groupby("Top_Article").head(5).reset_index(drop=True)
    return candidate_df

def get_ga_candidates(category, preferred_colors, avoid_colors, max_price, occasion, season=None, top_limit=100):
    """
    Takes requirements, queries Neo4j and outputs candidate pool.
    Filters by preferred_colors (list, match ANY), post-filters avoid_colors on both tops and bottoms.
    """
    print(f"Received request: {category}, preferred={preferred_colors}, avoid={avoid_colors}, Under ${max_price}, {occasion}, {season}")

    # Level 1 : Try strict matching with all constraints
    print("\nTrying strict matching with all constraints...")
    df = query_neo4j(category, preferred_colors, max_price, occasion, season, top_limit)

    # Check if we have enough candidates for GA
    if df["Top_Article"].nunique() < 100:
        # Level 2 : Relax soft constraints one by one
        print(f"Only found {df['Top_Article'].nunique()} unique tops. Dropping 'Season' constraint...")
        df = query_neo4j(category, preferred_colors, max_price, occasion=occasion, season=None, top_limit=top_limit)

    if df["Top_Article"].nunique() < 100:
        # Level 3 : Relax all soft constraints
        print(f"Still only found {df['Top_Article'].nunique()} unique tops. Dropping 'Occasion' constraints...")
        df = query_neo4j(category, preferred_colors, max_price, occasion=None, season=None, top_limit=top_limit)

    # Post-filter: exclude rows where Top_Color OR Bottom_Color is in avoid_colors
    if avoid_colors and not df.empty:
        avoid_set = set(avoid_colors)
        mask = ~(df["Top_Color"].isin(avoid_set) | df["Bottom_Color"].isin(avoid_set))
        df = df[mask].reset_index(drop=True)
        print(f"After avoid_colors filtering: {len(df)} candidate pairs remaining")

    # Enrich with garment types from articles DataFrame
    if not df.empty:
        df["Top_Article_str"] = df["Top_Article"].astype(str).str.zfill(10)
        df["Bottom_Article_str"] = df["Bottom_Article"].astype(str).str.zfill(10)
        df["Top_Type"] = df["Top_Article_str"].map(_article_type_map).fillna("")
        df["Bottom_Type"] = df["Bottom_Article_str"].map(_article_type_map).fillna("")
        df = df.drop(columns=["Top_Article_str", "Bottom_Article_str"])

    return df



#-------------------------------------------------------------
# For testing purposes
#-------------------------------------------------------------
if __name__ == "__main__":
    # Example usage
    candidates = get_ga_candidates(
        category="Ladieswear Top",
        color="Red",
        max_price=1000,
        occasion="Party",
        season="Summer",
        top_limit=100
    )

    if candidates.empty:
        print("\n No candidates found for the given requirements.")
    else:
        unique_tops = candidates['Top_Article'].nunique()
        print(f"\n Successfully generated {unique_tops} unique tops.")
        print(f"Total candidate pairs: {len(candidates)}") 
        print(candidates.head(10))
