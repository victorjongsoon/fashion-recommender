"""
load_graph.py — loads final_knowledge_graph.csv into Neo4j
"""
import pandas as pd
from neo4j import GraphDatabase
import numpy as np
import os, time, sys

NEO4J_URI  = os.environ.get("NEO4J_URI",  "bolt://kg-service:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASS = os.environ.get("NEO4J_PASS", "password123")
CSV_PATH   = os.environ.get("CSV_PATH",   "/data/final_knowledge_graph.csv")

print("=== KG Loader Starting ===", flush=True)
print(f"Neo4j: {NEO4J_URI}", flush=True)
print(f"CSV: {CSV_PATH}", flush=True)

# Load CSV
print(f"\nStep 1: Reading CSV...", flush=True)
try:
    df = pd.read_csv(CSV_PATH)
    df['head'] = df['head'].astype(str).str.zfill(10)
    print(f"  OK: {len(df):,} rows | {df['relation'].nunique()} relation types", flush=True)
    print(f"  Relations: {list(df['relation'].unique())}", flush=True)
except Exception as e:
    print(f"  ERROR reading CSV: {e}", flush=True)
    sys.exit(1)

# Connect to Neo4j
print(f"\nStep 2: Connecting to Neo4j...", flush=True)
driver = None
for i in range(30):
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
        driver.verify_connectivity()
        print(f"  OK: Connected!", flush=True)
        break
    except Exception as e:
        print(f"  [{i+1}/30] Not ready: {e}", flush=True)
        time.sleep(5)

if not driver:
    print("ERROR: Cannot connect to Neo4j", flush=True)
    sys.exit(1)

# Check if already loaded
print(f"\nStep 3: Checking if already loaded...", flush=True)
try:
    with driver.session() as s:
        n = s.run("MATCH (n:Item) RETURN count(n) AS c").single()["c"]
        print(f"  Current Item count: {n}", flush=True)
        if n > 1000:
            print(f"  Already loaded! Skipping.", flush=True)
            driver.close()
            sys.exit(0)
        print(f"  Not loaded yet, proceeding...", flush=True)
except Exception as e:
    print(f"  Check failed: {e} — proceeding anyway", flush=True)

# Load data
def load_batch(tx, rel, rows):
    lbl = "Item" if rel == "best_matches_with" else "Attribute"
    tx.run(f"""
        UNWIND $rows AS r
        MERGE (h:Item {{id: toString(r.head)}})
        MERGE (t:{lbl} {{id: toString(r.tail)}})
        MERGE (h)-[:`{rel}`]->(t)
    """, rows=rows)

print(f"\nStep 4: Loading data...", flush=True)
start = time.time()
for rel in df['relation'].unique():
    rows = df[df['relation']==rel].replace({np.nan:None}).to_dict('records')
    print(f"  Loading '{rel}' ({len(rows):,} rows)...", flush=True)
    with driver.session() as s:
        for i in range(0, len(rows), 500):
            s.execute_write(load_batch, rel, rows[i:i+500])
    print(f"    done!", flush=True)

print(f"\n=== KG loaded in {time.time()-start:.1f}s ===", flush=True)
driver.close()
