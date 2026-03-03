Fashion Recommender: Knowledge Graph (KG) Service

Phase 1: Import the Pre-Build Database
1. Download the neo4j_data.zip 
2. In your local repository, navigate to the data/ folder (create it if it doesn't exist)
3. Extract the zip file so that the path looks exactly like this:
fashion-recommender/data/neo4j_data/

Phase 2: Start the Docker Containers
1. Open your terminal in the root.
2. Run the following command to spin up Neo4j and the other services in the background:
docker-compose up -d
3. Verify the Database: Open your web browser and navigate to http://localhost:7474.
- Username: neo4j
- Password: password123
4. Run to visually the data in Multi Hop (Create the Ghost mode)
// This finds the "Ghost" nodes (Attributes) and links them to the "Real" nodes (Items)
MATCH (ghost:Attribute)
MATCH (real:Item {id: ghost.id})
WHERE ghost <> real
// Create a bridge so the data flows through
MERGE (ghost)-[:IS_SAME_AS]->(real)
RETURN count(*) as bridges_created
5. Run again
MATCH (top:Item {id: '0108775015'})-[match:best_matches_with]->(ghost:Attribute)
MATCH (ghost)-[:IS_SAME_AS]->(real:Item)
MATCH (real)-[r]->(attribute)
RETURN top, match, ghost, real, r, attribute


