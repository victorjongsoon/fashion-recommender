"""
Slot-filling metrics.

Given a list of (predicted, ground_truth) slot states, compute:
  - per-slot exact-match accuracy (after normalisation)
  - per-slot precision / recall / F1 (treating "filled correctly" as TP)
  - joint exact-match accuracy (all slots correct)
  - list-slot Jaccard (preferred_colors, avoid_colors)
  - refusal-handling accuracy (predicted refusal matches ground-truth refusal)
  - average turns per case

Ground-truth uses the literal string "__refused__" for slots the user refused.
"""
from __future__ import annotations

import re
import string
from typing import Any

LIST_SLOTS = {"preferred_colors", "avoid_colors"}
ALL_SLOTS = [
    "occasion", "destination", "month", "gender",
    "num_outfits", "max_price", "preferred_colors", "avoid_colors",
]

REFUSED_TOKEN = "__refused__"


# ── Normalisation ────────────────────────────────────────────────────────────
def _norm_scalar(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip().lower()
    s = s.translate(str.maketrans("", "", string.punctuation))
    s = re.sub(r"\s+", " ", s)
    return s


def _norm_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        parts = [p.strip() for p in v.split(",")]
        v = [p for p in parts if p]
    if not isinstance(v, list):
        v = [v]
    return sorted({_norm_scalar(x) for x in v if _norm_scalar(x)})


def _is_refused(gt: Any) -> bool:
    return isinstance(gt, str) and gt == REFUSED_TOKEN


# ── Comparison ───────────────────────────────────────────────────────────────
def slot_matches(slot: str, pred_value: Any, pred_refused: bool, gt: Any) -> bool:
    if _is_refused(gt):
        return bool(pred_refused)
    if pred_refused:
        return False
    if slot in LIST_SLOTS or isinstance(gt, list):
        return _norm_list(pred_value) == _norm_list(gt)
    if isinstance(gt, (int, float)):
        try:
            return float(pred_value) == float(gt)
        except (TypeError, ValueError):
            return False
    return _norm_scalar(pred_value) == _norm_scalar(gt)


def jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = set(_norm_list(a)), set(_norm_list(b))
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / max(1, len(sa | sb))


# ── Aggregate ────────────────────────────────────────────────────────────────
def compute(cases: list[dict]) -> dict:
    """
    cases: list of dicts with keys:
      - "ground_truth": dict[slot, value | "__refused__"]
      - "predicted":    dict[slot, {"value": ..., "filled": bool, "refused": bool}]
      - "num_turns":    int
    """
    per_slot_correct = {s: 0 for s in ALL_SLOTS}
    per_slot_total = {s: 0 for s in ALL_SLOTS}
    # For P/R/F1: TP = predicted filled AND matches GT; FP = predicted filled but mismatch;
    # FN = GT has a concrete value but predicted empty/wrong.
    tp = {s: 0 for s in ALL_SLOTS}
    fp = {s: 0 for s in ALL_SLOTS}
    fn = {s: 0 for s in ALL_SLOTS}

    list_jaccards = {s: [] for s in LIST_SLOTS}
    refusal_total = 0
    refusal_correct = 0
    joint_correct = 0
    total_turns = 0

    for c in cases:
        gt = c["ground_truth"]
        pred = c["predicted"]
        total_turns += c.get("num_turns", 0)
        all_ok = True
        for slot in ALL_SLOTS:
            if slot not in gt:
                continue
            per_slot_total[slot] += 1
            p = pred.get(slot) or {}
            pv = p.get("value")
            pf = bool(p.get("filled"))
            pr = bool(p.get("refused"))
            ok = slot_matches(slot, pv, pr, gt[slot])
            if ok:
                per_slot_correct[slot] += 1
            else:
                all_ok = False

            # P/R/F1 book-keeping
            gt_has_value = not _is_refused(gt[slot])
            if gt_has_value:
                if pf and ok:
                    tp[slot] += 1
                elif pf and not ok:
                    fp[slot] += 1
                else:
                    fn[slot] += 1
            else:
                # GT is refused; "positive" = prediction is refused.
                if pr and ok:
                    tp[slot] += 1
                elif pr and not ok:
                    fp[slot] += 1
                else:
                    fn[slot] += 1

            # Refusal accuracy (only count slots where GT is refused)
            if _is_refused(gt[slot]):
                refusal_total += 1
                if pr:
                    refusal_correct += 1

            # List-slot Jaccard (skip if GT is refused)
            if slot in LIST_SLOTS and not _is_refused(gt[slot]):
                list_jaccards[slot].append(jaccard(pv or [], gt[slot]))

        if all_ok:
            joint_correct += 1

    per_slot_accuracy = {
        s: (per_slot_correct[s] / per_slot_total[s] if per_slot_total[s] else None)
        for s in ALL_SLOTS
    }

    def _prf1(s: str) -> dict:
        p_denom = tp[s] + fp[s]
        r_denom = tp[s] + fn[s]
        p = tp[s] / p_denom if p_denom else 0.0
        r = tp[s] / r_denom if r_denom else 0.0
        f = 2 * p * r / (p + r) if (p + r) else 0.0
        return {"precision": round(p, 4), "recall": round(r, 4), "f1": round(f, 4)}

    per_slot_prf1 = {s: _prf1(s) for s in ALL_SLOTS}

    list_slot_jaccard = {
        s: (sum(v) / len(v) if v else None) for s, v in list_jaccards.items()
    }

    n = len(cases)
    return {
        "n_cases": n,
        "per_slot_accuracy": {k: (round(v, 4) if v is not None else None)
                              for k, v in per_slot_accuracy.items()},
        "per_slot_prf1": per_slot_prf1,
        "joint_exact_match": round(joint_correct / n, 4) if n else 0.0,
        "list_slot_jaccard": {k: (round(v, 4) if v is not None else None)
                              for k, v in list_slot_jaccard.items()},
        "refusal_accuracy": (round(refusal_correct / refusal_total, 4)
                             if refusal_total else None),
        "avg_turns": round(total_turns / n, 2) if n else 0.0,
    }
