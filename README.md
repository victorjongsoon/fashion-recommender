## SECTION 1 : PROJECT TITLE
## FashionAI – Stock Optimizer: A Hybrid Intelligent Reasoning System for Outfit Recommendation and Dead Stock Liquidation

<!-- TODO: add hero/architecture image here, e.g. -->
<!-- <img src="SystemCode/frontend/static/fashionai-banner.png" style="float: left; margin-right: 0px;" /> -->

---

## SECTION 2 : EXECUTIVE SUMMARY / PAPER ABSTRACT

Fashion retailers continuously accumulate **dead stock** — inventory that remains unsold for long periods due to over-ordering, seasonality shifts, or poor product discoverability. Globally, unsold apparel represents an estimated **USD 120 billion** in tied-up capital and contributes significantly to environmental waste. Compounding this, the industry faces e-commerce **return rates of 30–40%**, largely caused by the "imagination gap" — consumers' uncertainty about fit, appearance, and contextual appropriateness of clothing purchased online.

Existing solutions address only half of this problem. Pure-play virtual try-on (VTON) tools such as Perfect Corp and GlamAR act as passive visualisers without contextual decision intelligence, while traditional recommendation engines driven by collaborative filtering suffer from severe popularity bias, actively suppressing slow-moving stock and ignoring external context such as weather and occasion.

**FashionAI – Stock Optimizer** is a hybrid intelligent reasoning system that bridges this gap. It generates compatible, context-appropriate outfit recommendations while strategically increasing the exposure of dead stock items. The system integrates four complementary components:

1. A **Neo4j knowledge graph** that enforces structured, explainable constraints (season, occasion, gender, price, weather).
2. **Transaction-based co-purchase analysis** using the *lift* measure to infer item compatibility from historical buying patterns.
3. A **Genetic Algorithm (GA)** that optimises Top–Bottom outfit combinations by maximising compatibility and budget fit, with a weighted bonus that gently prioritises dead stock without compromising aesthetic or contextual quality.
4. An **IDM-VTON** module that lets users visualise recommended outfits on their own body to reduce the imagination gap.

A **chatbot** front-end powered by an LLM interprets free-form user input (e.g. travel plans, occasion, budget) into structured constraints, which are then grounded with a **weather API** before being passed to the reasoning pipeline. The result is a web-based system that serves users with aesthetically confident, context-aware outfit suggestions while giving retailers an intelligent mechanism to liquidate dead stock based on contextual appropriateness rather than popularity.

---

## SECTION 3 : CREDITS / PROJECT CONTRIBUTION

| Official Full Name | Student ID | Work Items (Who Did What) | Email |
| :----------------- | :--------: | :------------------------ | :---- |
| How Yong Chen           | A0340116W | <!-- TODO --> | <!-- TODO --> |
| Victor Jong Soon Peng   | A0339815U | <!-- TODO --> | victorjongsoonpeng@u.nus.edu |
| Joshua Yuan Zilin       | A0283899Y | <!-- TODO --> | <!-- TODO --> |

---

## SECTION 4 : VIDEO OF SYSTEM MODELLING & USE CASE DEMO

- **Promotion Video:** https://youtu.be/hy_2oP7v04A
- **Technical Video:** https://youtu.be/o97mxxSiHvU

Note: It is not mandatory for every project member to appear in the video presentation; presentation by one project member is acceptable.

---

## SECTION 5 : USER GUIDE

`Refer to appendix <Installation & User Guide> in project report at Github Folder: ProjectReport`

### Prerequisites

- Docker & Docker Compose
- Python 3.10+
- Node.js 18+ (for the frontend)
- A pre-built Neo4j database dump (`neo4j_data.zip`) — [download from Google Drive](https://drive.google.com/file/d/1zWZ-JxVkoXUAvytiSjidgpplUfT_N39l/view?usp=sharing) (the `data/` directory is git-ignored due to its size, so this must be downloaded separately)

### [ 1 ] Import the Pre-Built Knowledge Graph

1. Download `neo4j_data.zip` from the [Google Drive link](https://drive.google.com/file/d/1zWZ-JxVkoXUAvytiSjidgpplUfT_N39l/view?usp=sharing) above.
2. In the repository, navigate to the `SystemCode/data/` folder (create it if it does not exist).
3. Extract the archive so the path is exactly: `fashion-recommender/SystemCode/data/neo4j_data/`

### [ 2 ] Start the Services

From the repository root:

```bash
docker-compose up -d
```

Verify Neo4j is running at `http://localhost:7474`
- Username: `neo4j`
- Password: `password123`

### [ 3 ] Install Python Dependencies

```bash
pip install -r SystemCode/requirements.txt
```

### [ 4 ] Launch the Frontend

<!-- TODO: confirm exact frontend start command -->
```bash
cd SystemCode/frontend
npm install
npm run dev
```

### [ 5 ] Open the Application

Navigate to `http://localhost:3000` (or the port reported by the frontend) to start chatting with FashionAI and generating outfit recommendations.

### Sample Neo4j Query (Outfit Multi-Hop View)

```cypher
MATCH (top:Item {id: '0108775015'})-[match:best_matches_with]->(bottom:Item)
OPTIONAL MATCH (top)-[r_top]->(top_attr:Attribute)
OPTIONAL MATCH (bottom)-[r_bot]->(bot_attr:Attribute)
RETURN top, match, bottom, r_top, top_attr, r_bot, bot_attr
```

---

## SECTION 6 : PROJECT REPORT / PAPER

`Refer to project report at Github Folder: ProjectReport` <!-- TODO: add final report PDF -->

---

## SECTION 7 : MISCELLANEOUS

`Refer to Github Folder: Miscellaneous`

<!-- TODO: list supporting artefacts such as data preparation notebooks, evaluation results, A/B test outputs, slot-filling evaluation outputs -->

---

**This [Intelligent Reasoning Systems (IRS)](https://www.iss.nus.edu.sg/stackable-certificate-programmes/intelligent-systems "Intelligent Reasoning Systems") project is part of the Master of Technology in Artificial Intelligence Systems (ISY5001) offered by [NUS-ISS](https://www.iss.nus.edu.sg "Institute of Systems Science, National University of Singapore").**
