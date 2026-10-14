# data/strips

`labels.csv` is the ground truth for your own strip photos. The photos themselves never go in git (they are ignored by `.gitignore`); keep them in `private-strips/` on your laptop.

## Columns

| Column | What to write |
|---|---|
| file | Photo file name, `g-001.jpg` style |
| brand_truth | Brand exactly as printed on the full strip or box |
| ingredients_truth | Generic names printed on the strip, separated by `;` |
| strength_truth | One strength per ingredient, same order, separated by `;` |
| group | One of: clean, torn, glare, low_light, hindi_bilingual, lookalike |
| notes | What makes this photo hard or special |
| photographer | Initials only |
| permission | `own` or `permission from <role>` (no names) |

## Target counts (total 46)

| Group | Target |
|---|---|
| clean | 15 |
| torn | 10 |
| glare | 8 |
| low_light | 4 |
| hindi_bilingual | 3 |
| lookalike | 6 |

Fill the truth columns from the physical strip or box, never from memory. The three rows already in `labels.csv` are examples only: delete them before you measure.
