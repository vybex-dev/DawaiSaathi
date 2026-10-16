# Phase 2.1 — catalogue build tool

`npm run build:catalog` turns the source CSVs into `assets/catalog.db` (bundled with the app) and
writes the hand-check files to `build/`. About 16 seconds, no network.

## Inputs

Put these in `data/source/` (git ignores that folder; the files are large and carry licence terms):

| File | Role |
|---|---|
| `A_Z_medicines_dataset_of_India.csv` | Base. One row per product: id, name, manufacturer, pack label, two composition columns. Required. |
| `medicine_data.csv` | Cross-check. Full ingredient list per product. |
| `Medicine_Details.csv` | Cross-check. Full ingredient list per product. |

Flags: `--az`, `--medicine-data`, `--medicine-details`, `--demo`, `--out`, `--out-dir`,
`--max-rows` (1 to 30000), `--two-ingredient corroborated|all`, `--source "..."`, `--licence "..."`.

```
npm run build:catalog -- --licence "CC0: 1.0 (copied from the Kaggle page)"
```

**Licence.** I could not confirm the licence of any of the three files. Read it on each Kaggle page,
pass it with `--licence`, and put it in `DISCLOSURE.md`. Until you do, `meta.licence` says
`UNCONFIRMED` and the build prints a warning. The `medicine_data` and `Medicine_Details` pages
describe their data as scraped from 1mg, which is the case the playbook warns about.

## The safety rule that shapes the catalogue

The base file has only two composition columns, so a product with three or more ingredients is cut
to two, with no marker. Measured on the files you supplied, about 1,630 of the 1,668 disagreements were products
with a longer list in a cross-check file (examples: `aspirin + rosuvastatin` was really `aspirin + clopidogrel +
rosuvastatin`; `glimepiride + metformin` was really `... + pioglitazone`). A missing ingredient would
make an interaction check look safer than it is. So:

- **One ingredient:** accepted (the base file cannot truncate a single ingredient).
- **Two ingredients:** accepted only if every cross-check file that lists the product gives the same
  ingredient names AND at least one does. Otherwise rejected as `two_ingredient_unverified`.
- **Any file disagrees:** rejected as `sources_disagree`; the reject row shows both lists.
- `--two-ingredient all` switches off the first of those two rules. Do not use it for the demo
  without checking each two-ingredient brand by hand.

## What is kept and what is not (last run on your files)

| | Rows |
|---|---|
| Source rows | 253,973 |
| Rejected (`build/rejects.csv`) | 107,613: `two_ingredient_unverified` 105,939; `sources_disagree` 1,668; `empty_brand` 5; `unparseable_strength` 1 |
| Usable | 146,360 |
| Kept (cap 30,000) | 30,000, of which 15,114 are confirmed by another file; 4,578 have two ingredients |
| Over the cap (`build/excluded.csv`) | 116,360 |
| File size | 5.48 MB (warning above 15 MB) |

Nothing is silently dropped: every source row is in the catalogue, in `rejects.csv` or in
`excluded.csv`.

**How the 30,000 are chosen.** In order: your demo brands, then products another file confirms, then
active before discontinued, then source order. Source order is arbitrary (ids are not popularity
ranked: Dolo 650 is id 58235), so beyond the first two groups the catalogue is a sample, not a
ranking. That is fine for a demo only because the app abstains on a brand it cannot find.

**Extra reject reason.** `missing_id` exists for completeness; it did not occur.

## Rules that came from the data

- Ingredient names are lowercase generic names, salts kept (`chlorpheniramine maleate`). Matching
  salts to classes is the job of the aliases in Prompt 2.2.
- A strength is a number above zero plus a unit (`500mg`, `5mg/5ml`, `0.10% w/w`, `.75% w/w`,
  `60Million spores`). The text is stored as written. `NA` is stored as `null`. Anything else is
  rejected: the one case so far is `30.mg/5ml`.
- Row strength is the ingredient strengths joined with ` + ` (`500mg + 125mg`).
- Form comes from the pack label (`strip of 10 tablets` is `tablet`). 551 rows have no form (`null`).
- Ids are `az-<source id>`.
- `ingredient_class` is created empty. Prompt 2.2 fills it.

## Brand normalisation (`tools/normalize-build.ts`)

The playbook rules, with three decisions you should know about:

1. A bare number is kept: `Dolo 650` becomes `dolo 650`, not `dolo`. `Allegra 120mg` becomes
   `allegra`, because `120mg` is a strength.
2. `capsule` (singular) is also a suffix token. The playbook lists `capsules` and `cap`; the
   dataset writes `Capsule`.
3. Combining marks are kept, so Hindi brand names survive. Everything else that is not a letter or
   digit becomes a space.

The app's own `src/engine/normalize.ts` (Prompt 3.x) must follow the same rules. Five brands
normalise to nothing because their name is only suffix words (`Cap Tablet`, `Forte-MR`, `Mr 20mg`,
`XL 200mg/500mg`) and are rejected as `empty_brand`.

**Consequence for matching.** `Allegra 120` (no unit) will not equal `allegra`. The matcher
(Prompt 3.2) should search with fewer tokens when the full query finds nothing.

## Your check: `build/verify-sheet.csv`

List the roughly 100 brands you will demo in `tools/demo-brands.txt`, one per line, **as printed on the
strip including words like Syrup or Cream** (`Ascoril LS` does not match `Ascoril LS Syrup`).
Rebuild, open the sheet, and for every row compare brand, ingredients and strength with the
physical strip or a trusted reference. Fill `source_url`, `verified_by`, `verified_on` and `ok`.

- A brand missing from the catalogue gets a row saying `NOT IN CATALOGUE`, with the reject reason
  if there is one (for example `two_ingredient_unverified`). Check that brand by hand from the
  strip. Do not demo an unverified two-ingredient brand.
- A brand that matches several rows (several strengths or manufacturers) gets several rows.
- The starter list in the file is only an example. It does not count as your demo list.

## Getting the new catalogue onto the phone

A phone that already ran the app keeps its old `dawai.db`, so it ignores a rebuilt `catalog.db`.
Set `FORCE_CATALOG_REFRESH = true` in `src/data/db.ts`, start the app once, then set it back to
`false`. This also erases medicines, scan cache and settings on that phone. Details are in
`docs/phase-1.3-database.md`.

## Tests

`npm test -- tools` runs the normaliser tests, the parser tests and a full build on small fixtures
(every reject reason, the cap order, the verify sheet, and the app's `catalogRepo` reading the
result). `tests/tools/bundled-catalog.test.ts` opens the real `assets/catalog.db` and checks the
`dolo` prefix query and the meta table; it skips itself while the file is still the placeholder.
