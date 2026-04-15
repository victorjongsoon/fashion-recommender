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
// 1. Find the top and its matching bottoms
MATCH (top:Item {id: '0108775015'})-[match:best_matches_with]->(bottom:Item)
// 2. Expand all attributes for the Top (using the wildcard 'r_top')
OPTIONAL MATCH (top)-[r_top]->(top_attr:Attribute)
// 3. Expand all attributes for the Bottoms (using the wildcard 'r_bot')
OPTIONAL MATCH (bottom)-[r_bot]->(bot_attr:Attribute)
// 4. Return every piece of the puzzle to generate the visual graph
RETURN top, match, bottom, r_top, top_attr, r_bot, bot_attr

