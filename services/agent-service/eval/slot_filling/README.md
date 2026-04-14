# Slot-Filling Evaluation

Standalone evaluation of the FashionAI slot-filling extractor against a hand-authored
natural-language dataset. Calls the OpenAI chat completions API directly with
`response_format={"type":"json_object"}` — no LangChain, no tool-calling, 1 request per turn.

## Files

- `eval_slot_filling.ipynb` — the notebook to run.
- `dataset.jsonl` — 48 natural-language test cases across 8 categories.
- `metrics.py` — per-slot / per-category / confusion metrics (imported by the notebook).
- `requirements.txt` — dev deps (Jupyter, OpenAI SDK, pandas, matplotlib, seaborn, openpyxl).
- `predictions.json` — cached model predictions (written by the SAVE cell; re-load to skip re-running).
- `report.json` / `report.md` / `report.xlsx` — written by the notebook's export cells.

## Run

1. Set `OPENAI_API_KEY` in the repo-root `.env`. Optionally set `OPENAI_MODEL` (default `gpt-4o-mini`).
2. Install deps:
   ```
   pip install -r requirements.txt
   ```
3. Open `eval_slot_filling.ipynb` and run all cells.

Total run: ~53 OpenAI requests (~one per turn). Outputs land in this folder.
