import pandas as pd
from neo4j import GraphDatabase

# Connect to the Dockerize Neo4j database
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123") 
driver = GraphDatabase.driver(URI, auth=AUTH)

def query_neo4j(category, color, max_price, occasion=None, season=None, top_limit=100):
    """Helper function to query Neo4j based on the requirements."""

    # Hard Constraints (Always applied)
    query_parts = [
        "MATCH (top:Item)-[:in_category]->(cat:Attribute) WHERE toLower(cat.id) CONTAINS toLower($category)",
        "MATCH (top)-[:has_color]->(col:Attribute) WHERE toLower(col.id) = toLower($color)",
        "MATCH (top)-[:has_price]->(price:Attribute) WHERE toFloat(price.id) <= $max_price"
    ]

    # Soft Constraints (Applied if they aren't None)
    if occasion:
        query_parts.append("MATCH (top)-[:has_occasion]->(occ:Attribute) WHERE toLower(occ.id) = toLower($occasion)")
    if season:
        query_parts.append("MATCH (top)-[:has_season]->(sea:Attribute) WHERE toLower(sea.id) = toLower($season)")

    # Assemble the final query
    final_query = "\n".join(query_parts) + """
    WITH top LIMIT $top_limit
    MATCH (top:Item)-[match:best_matches_with]->(bottom:Attribute)
    RETURN top.id AS Top_Article,
           bottom.id AS Bottom_Article,
           match.weight AS Lift_Score
    ORDER BY top.id, match.weight DESC
    """

    with driver.session() as session:
        results = session.run(
            final_query,
            category=category,
            color=color,
            max_price=float(max_price),
            occasion=occasion,
            season=season,
            top_limit=top_limit
        )
        data = [record.data() for record in results]

    if not data:
        return pd.DataFrame(columns=["Top_Article", "Bottom_Article", "Lift_Score"])
    
    candidate_df = pd.DataFrame(data)
    candidate_df = candidate_df.groupby("Top_Article").head(5).reset_index(drop=True)
    return candidate_df

def get_ga_candidates(category, color, max_price, occasion, season, top_limit=100):
    """
    Takes requirements, quries Neo4j and outputs candidate pool
    """
    print(f"Received request: {category}, {color}, Under ${max_price}, {occasion}, {season}")

    # Level 1 : Try strict matching with all constraints
    print("\nTrying strict matching with all constraints...")
    df = query_neo4j(category, color, max_price, occasion, season, top_limit)

    # Check if we have enough candidates for GA
    if df["Top_Article"].nunique() >= 100:
        return df
    
    # Level 2 : Relax soft constraints one by one
    print(f"Only found {df['Top_Article'].nunique()} unique tops. Dropping 'Season' constraint...")
    df = query_neo4j(category, color, max_price, occasion=occasion, season=None, top_limit=top_limit)

    if df["Top_Article"].nunique() >= 100:
        return df
    
    # Level 3 : Relax all soft constraints
    print(f"Still only found {df['Top_Article'].nunique()} unique tops. Dropping 'Occasion' constraints...")
    df = query_neo4j(category, color, max_price, occasion=None, season=None, top_limit=top_limit)

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
