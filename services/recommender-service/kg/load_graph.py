import pandas as pd
from neo4j import GraphDatabase
import numpy as np
from pathlib import Path
import os

# Load CSV files
print("Loading CSV files...")
current_folder = Path.cwd()
DATA_DIR = current_folder / "data" / "processed"
final_kg = pd.read_csv(DATA_DIR / "final_knowledge_graph.csv")

# Forces the column to be a string and adds the leading zero back if it's missing!
final_kg['head'] = final_kg['head'].astype(str).str.zfill(10)

# Connect to the local Docker database
print("Connecting to Neo4j Docker database...")
URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")  # Default username and password for Neo4j
driver = GraphDatabase.driver(URI, auth=AUTH)

def load_edges(tx, rel_type, edges_subset):
    if rel_type == 'best_matches_with':
        query = """
        UNWIND $rows AS row
        MERGE (h:Item {id: toString(row.head)})
        MERGE (t:Item {id: toString(row.tail)})
        MERGE (h)-[r:`best_matches_with`]->(t)
        SET r.weight = row.weight,
            r.tail_color = row.tail_color
        """
    else:
        query = f"""
        UNWIND $rows AS row
        MERGE (h:Item {{id: toString(row.head)}})
        MERGE (t:Attribute {{id: toString(row.tail)}})
        MERGE (h)-[r:`{rel_type}`]->(t)
        SET r.weight = row.weight,
            r.tail_color = row.tail_color
        """
    records = edges_subset.replace({np.nan: None}).to_dict('records')
    tx.run(query, rows=records)

with driver.session() as session:
    print("Pushing Knowledge Graph data...")
    for relation in final_kg['relation'].unique():
        print(f"   -> Loading relation: {relation}")
        subset = final_kg[final_kg['relation'] == relation]
        session.execute_write(load_edges, relation, subset)

print("Knowledge Graph successfully loaded!")
driver.close()