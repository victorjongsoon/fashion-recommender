# FashionAI – SystemCode

This folder contains the full implementation of **FashionAI – Stock Optimizer**: a microservice-based, hybrid intelligent reasoning system that generates context-aware outfit recommendations while prioritising dead stock.

For the project-level overview, see the root [`README.md`](../README.md).

---

## 1. Architecture

The system is composed of a React/Vite frontend and six backend services, orchestrated with Docker Compose.

```
┌────────────┐   ┌────────────────┐   ┌──────────────────────┐
│  frontend  │──▶│  agent-service │──▶│  weather-service      │
│  (Vite)    │   │  (LLM chatbot, │   │  (weather API proxy)  │
│  :5173     │   │   slot filling)│   └──────────────────────┘
└────────────┘   │   :8004        │   ┌──────────────────────┐
                 │                │──▶│ recommender-service   │
                 │                │   │ (KG query + GA opt.)  │
                 │                │   │ :8003                 │
                 │                │   │   ├─ kg/  (Neo4j Cypher)
                 │                │   │   └─ ga/  (GA engine) │
                 │                │   └──────────┬───────────┘
                 │                │              │
                 │                │              ▼
                 │                │   ┌──────────────────────┐
                 │                │   │ kg-service (Neo4j)   │
                 │                │   │ :7474 / :7687        │
                 │                │   └──────────────────────┘
                 │                │   ┌──────────────────────┐
                 │                │──▶│ image-service         │
                 │                │   │ (product image serve) │
                 │                │   │ :8001                 │
                 │                │   └──────────────────────┘
                 │                │   ┌──────────────────────┐
                 └────────────────┘──▶│ vton-service          │
                                      │ (IDM-VTON via HF)     │
                                      │ :8002                 │
                                      └──────────────────────┘
```

### Services

| Service | Port | Purpose |
| :------ | :--: | :------ |
| `frontend`            | 5173 | React + Vite UI. Chat interface, outfit cards, VTON preview. |
| `agent-service`       | 8004 | LLM agent (OpenAI). Slot-filling from natural-language input; orchestrates weather + recommender + VTON. |
| `weather-service`     | 8005 | Wraps an external weather API to ground user location/date in real conditions. |
| `recommender-service` | 8003 | Core reasoning pipeline: Cypher queries against Neo4j (`kg/`) to build a candidate pool, then a Genetic Algorithm (`ga/`) to optimise Top–Bottom outfits. Strategy selectable via `RECOMMENDATION_STRATEGY` (`kg_ga` / `kg_lift` / `kg_random`). |
| `kg-service`          | 7474 / 7687 | Neo4j database storing the fashion knowledge graph (items, attributes, `best_matches_with` relations). |
| `image-service`       | 8001 | Serves product images from `data/raw/images/`. |
| `vton-service`        | 8002 | Virtual try-on. Proxies to IDM-VTON on Hugging Face Spaces. |

### Folder Layout

```
SystemCode/
├── docker-compose.yml        # Orchestrates all services
├── requirements.txt          # Shared deps for running notebooks / scripts locally
├── .env.example              # Template — copy to .env
├── data/
│   ├── raw/                  # Raw H&M dataset (articles, transactions, images)
│   ├── input/                # Curated inputs to the pipeline
│   ├── processed/            # Derived artefacts (lift tables, labels, etc.)
│   └── neo4j_data/           # Pre-built Neo4j database volume
├── frontend/                 # React + Vite + TypeScript UI
├── scripts/                  # Offline analysis & GA prototyping notebooks
│   ├── h_and_m_analysis.ipynb
│   ├── fashion200k_analysis.ipynb
│   └── ga_script.ipynb
└── services/
    ├── agent-service/        # FastAPI LLM agent (app/, eval/)
    ├── image-service/        # FastAPI static image server
    ├── recommender-service/  # FastAPI + Neo4j driver + GA
    │   ├── kg/               # Cypher queries / KG access layer
    │   └── ga/               # Genetic Algorithm implementation
    ├── vton-services/        # FastAPI → IDM-VTON bridge
    └── weather-service/      # FastAPI weather API wrapper
```

---

## 2. Prerequisites

- Docker Desktop (with Docker Compose v2)
- An OpenAI API key (for `agent-service`)
- A Hugging Face token (for `vton-service`)
- ~a few GB of disk for the pre-built Neo4j volume and product images

Optional (for local notebook work without Docker):
- Python 3.10+
- Node.js 18+

---

## 3. Setup

### 3.1 Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
HF_TOKEN=hf_...
```

### 3.2 Import the pre-built Knowledge Graph

<!-- TODO: add download link for neo4j_data.zip -->

1. Download `neo4j_data.zip`.
2. Extract into `SystemCode/data/` so the path is exactly:
   ```
   SystemCode/data/neo4j_data/
   ```

### 3.3 Provide the product images

Place the H&M product images under:

```
SystemCode/data/raw/images/
```

(The `image-service` mounts this directory read-only.)

---

## 4. Running the System

From the `SystemCode/` directory:

```bash
docker-compose up -d --build
```

Once all services are healthy:

| UI / Endpoint         | URL                              |
| :-------------------- | :------------------------------- |
| Frontend              | http://localhost:5173            |
| Agent service (API)   | http://localhost:8004/docs       |
| Recommender (API)     | http://localhost:8003/docs       |
| Weather service (API) | http://localhost:8005/docs       |
| Image service         | http://localhost:8001            |
| VTON service (API)    | http://localhost:8002/docs       |
| Neo4j Browser         | http://localhost:7474 (`neo4j` / `password123`) |

Stop everything:

```bash
docker-compose down
```

Rebuild a single service after code changes:

```bash
docker-compose up -d --build recommender-service
```

Tail logs:

```bash
docker-compose logs -f agent-service
```

---

## 5. Recommendation Strategies

`recommender-service` supports three strategies via the `RECOMMENDATION_STRATEGY` env var (used for A/B comparison and ablation):

| Value       | Description |
| :---------- | :---------- |
| `kg_ga`     | **Default.** Neo4j KG filters candidates → GA optimises Top–Bottom outfits using a lift-based fitness function with a dead-stock bonus. |
| `kg_lift`   | KG filters candidates → greedy lift-score matching, no GA. |
| `kg_random` | KG filters candidates → random pairing. Baseline. |

Change it in `docker-compose.yml` and restart `recommender-service`.

---

## 6. Development Notes

### Frontend

```bash
cd frontend
npm install
npm run dev          # hot reload on http://localhost:5173
```

See [`frontend/README.md`](frontend/README.md) for component-level details.

### Notebooks

The `scripts/` folder contains the offline analysis used to build the knowledge graph and tune the GA:

- `h_and_m_analysis.ipynb` — EDA, dead-stock labelling, lift-table computation
- `fashion200k_analysis.ipynb` — auxiliary dataset exploration
- `ga_script.ipynb` — GA prototype & fitness-function tuning

Install local dependencies with:

```bash
pip install -r requirements.txt
```

### Agent-service evaluation

`services/agent-service/eval/` contains slot-filling evaluation and A/B test harnesses referenced in the project report.

---

## 7. Sample Neo4j Query

Visualise an item, its attributes, and its best-matching bottoms:

```cypher
MATCH (top:Item {id: '0108775015'})-[match:best_matches_with]->(bottom:Item)
OPTIONAL MATCH (top)-[r_top]->(top_attr:Attribute)
OPTIONAL MATCH (bottom)-[r_bot]->(bot_attr:Attribute)
RETURN top, match, bottom, r_top, top_attr, r_bot, bot_attr
```

---

## 8. Troubleshooting

- **Neo4j container exits immediately** — the `data/neo4j_data/` folder is missing or was created by a different Neo4j version. Re-extract the provided dump.
- **`agent-service` returns 401** — check `OPENAI_API_KEY` in `.env` and restart the service.
- **VTON returns 5xx / auth errors** — verify `HF_TOKEN` is valid and has access to the IDM-VTON Space.
- **Frontend can't reach agent-service** — `VITE_AGENT_SERVICE_URL` is baked at build time. Rebuild the frontend container after changing it.
