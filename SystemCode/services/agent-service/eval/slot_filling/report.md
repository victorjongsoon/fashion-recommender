# Slot-Filling Evaluation Report

- **Model:** `gpt-4o-mini`
- **Dataset hash:** `d7ef5f10`
- **Cases:** 48
- **Joint exact-match:** 0.9792
- **Refusal accuracy:** None
- **Avg turns per case:** 1.1

## Per-slot accuracy

| Slot | Accuracy |
|---|---|
| `occasion` | 1.0 |
| `destination` | 1.0 |
| `month` | 1.0 |
| `gender` | 1.0 |
| `num_outfits` | 1.0 |
| `max_price` | 1.0 |
| `preferred_colors` | 0.9792 |
| `avoid_colors` | 1.0 |

## Per-slot Precision / Recall / F1

| Slot | P | R | F1 |
|---|---|---|---|
| `occasion` | 1.0 | 1.0 | 1.0 |
| `destination` | 1.0 | 1.0 | 1.0 |
| `month` | 1.0 | 1.0 | 1.0 |
| `gender` | 1.0 | 1.0 | 1.0 |
| `num_outfits` | 1.0 | 1.0 | 1.0 |
| `max_price` | 1.0 | 1.0 | 1.0 |
| `preferred_colors` | 0.9792 | 1.0 | 0.9895 |
| `avoid_colors` | 1.0 | 1.0 | 1.0 |

## List-slot Jaccard

| Slot | Jaccard |
|---|---|
| `avoid_colors` | 1.0 |
| `preferred_colors` | 0.9896 |

## Per-category accuracy

| Category | Accuracy | Cases |
|---|---|---|
| `full-oneshot` | 1.0 | 10 |
| `occasion-mapping` | 1.0 | 10 |
| `gender-phrasing` | 1.0 | 5 |
| `destination-alias` | 1.0 | 5 |
| `budget-phrasing` | 1.0 | 5 |
| `colour-synonym` | 0.8 | 5 |
| `partial-followup` | 1.0 | 5 |
| `out-of-palette` | 1.0 | 3 |
