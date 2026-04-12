"""
Offline evaluation runner for the FashionAI slot-filling agent.

Replays each case in `dataset.jsonl` through the production extractor chain
(no HTTP), then writes `report.json` + `report.md`.

Usage (from services/agent-service):
    python -m eval.run_eval
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running as a script from the service root.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

from app.slots import SlotState, REQUIRED_SLOTS     # noqa: E402
from app.extractor import extract, merge            # noqa: E402
from app.llm import OLLAMA_MODEL                    # noqa: E402
from app.results import (                            # noqa: E402
    build_results, REQUIRED_EXTRACTED_KEYS, REQUIRED_KG_INPUT_KEYS,
)
from eval.metrics import compute                     # noqa: E402

DATASET = HERE / "dataset.jsonl"
REPORT_JSON = HERE / "report.json"
REPORT_MD = HERE / "report.md"


def load_cases(path: Path) -> list[dict]:
    cases = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            cases.append(json.loads(line))
    return cases


def state_to_predicted(state: SlotState) -> dict:
    out = {}
    for k in REQUIRED_SLOTS:
        s = state.slot(k)
        out[k] = {"value": s.value, "filled": s.filled, "refused": s.refused}
    return out


def replay_case(case: dict) -> dict:
    """Replay one test case through the extractor. Returns the predicted
    per-slot state."""
    state = SlotState()
    for i, user_msg in enumerate(case["turns"]):
        target_slot = state.next_empty() or REQUIRED_SLOTS[i % len(REQUIRED_SLOTS)]
        result = extract(state, target_slot, user_msg)
        merge(state, target_slot, result)
    return state_to_predicted(state)


def golden_shape_check() -> bool:
    """Assert build_results output contains every frontend-required key."""
    s = SlotState()
    s.occasion.mark_filled("Casual")
    s.destination.mark_filled("Tokyo")
    s.month.mark_filled("June")
    s.gender.mark_filled("male")
    s.num_outfits.mark_filled(3)
    s.max_price.mark_filled(200.0)
    s.preferred_colors.mark_filled(["Black"])
    s.avoid_colors.mark_filled([])
    os.environ.setdefault("WEATHER_SERVICE_URL", "http://127.0.0.1:1")
    r = build_results(s)
    if not REQUIRED_EXTRACTED_KEYS.issubset(r["extracted"].keys()):
        return False
    if not r["kg_inputs"]:
        return False
    return REQUIRED_KG_INPUT_KEYS.issubset(r["kg_inputs"][0].keys())


def write_report_md(report: dict) -> str:
    lines = [
        "# Slot-Filling Evaluation Report",
        "",
        f"- **Model:** `{report['model_id']}`",
        f"- **Cases:** {report['n_cases']}",
        f"- **Joint exact-match accuracy:** {report['joint_exact_match']}",
        f"- **Refusal accuracy:** {report['refusal_accuracy']}",
        f"- **Avg turns per case:** {report['avg_turns']}",
        f"- **Golden-shape contract:** {'PASS' if report['golden_shape'] else 'FAIL'}",
        "",
        "## Per-slot accuracy",
        "",
        "| Slot | Accuracy |",
        "|---|---|",
    ]
    for slot, acc in report["per_slot_accuracy"].items():
        lines.append(f"| `{slot}` | {acc} |")
    lines += [
        "",
        "## Per-slot Precision / Recall / F1",
        "",
        "| Slot | Precision | Recall | F1 |",
        "|---|---|---|---|",
    ]
    for slot, d in report["per_slot_prf1"].items():
        lines.append(f"| `{slot}` | {d['precision']} | {d['recall']} | {d['f1']} |")
    lines += [
        "",
        "## List-slot Jaccard",
        "",
        "| Slot | Jaccard |",
        "|---|---|",
    ]
    for slot, j in report["list_slot_jaccard"].items():
        lines.append(f"| `{slot}` | {j} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    cases = load_cases(DATASET)
    print(f"[eval] loaded {len(cases)} cases, model={OLLAMA_MODEL}")

    evaluated = []
    for i, case in enumerate(cases, 1):
        print(f"[eval] {i}/{len(cases)}  {case['id']}")
        try:
            pred = replay_case(case)
        except Exception as e:
            print(f"[eval] {case['id']} extractor crash: {e}")
            pred = {k: {"value": None, "filled": False, "refused": False}
                    for k in REQUIRED_SLOTS}
        evaluated.append({
            "ground_truth": case["ground_truth"],
            "predicted": pred,
            "num_turns": len(case["turns"]),
        })

    metrics = compute(evaluated)
    metrics["model_id"] = OLLAMA_MODEL
    metrics["golden_shape"] = golden_shape_check()

    REPORT_JSON.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    REPORT_MD.write_text(write_report_md(metrics), encoding="utf-8")
    print(f"[eval] wrote {REPORT_JSON} and {REPORT_MD}")
    print(f"[eval] joint exact-match = {metrics['joint_exact_match']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
