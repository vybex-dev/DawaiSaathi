# STATE.md — Dawai Saathi

Paste this whole file at the end of the Context Pack (after the word STATE) in every new chat.
Update it with the Handoff prompt at the end of each phase. Keep it under about 400 words of prose.

## Versions
Fill in on day 1. Write UNVERIFIED if you have not run the command.

| Tool | Version | Command to check |
|---|---|---|
| node | | `node -v` |
| npm | | `npm -v` |
| expo | ~57.0.28 (from package.json; confirm with the command) | `npx expo --version` |
| react-native | 0.86.3 (react 19.2.3, TypeScript ~6.0.3) | `npm ls react-native` |
| supabase CLI | | `npx supabase --version` |
| deno | | `deno --version` |
| Android Studio | | Help > About |
| Test phone model | | |
| Test phone Android version | | Settings > About phone |

## Decisions
One line each: `YYYY-MM-DD — decision — reason`.

- 2026-10-14 — Free-Claude build playbook, one fresh chat per prompt — free chats drift and have usage limits.
- 2026-10-14 — TypeScript 6 needs explicit `types` in tsconfig (jest, node) — it no longer auto-includes @types packages.
- 2026-10-14 — Template `src/app` removed; routes live in root `app/` — Expo Router prefers `src/app` when both exist.
- 2026-10-14 — Phase 1.2 stub session flag lives in SQLite settings until Prompt 6.2 — lets the gate be tested.
- 2026-10-15 — Catalogue and user tables share one file, `dawai.db` (catalog.db is copied in on first run) — keeps the Phase 1.2 provider setup; consequence in docs/phase-1.3-database.md.
- 2026-10-15 — Repositories depend on a small `Db` interface, not expo-sqlite — lets tests run real SQL in memory.
- 2026-10-15 — DB tests use `node:sqlite` (Node 22.13+), not better-sqlite3 — no native install; check `node -v`.
- 2026-10-16 — Catalogue base file is the A-Z dataset; it cuts 3+ ingredient products to 2, so two-ingredient rows are kept only when another file confirms them — a missing ingredient would make a check look safer than it is. Switch: `--two-ingredient all`.
- 2026-10-16 — Brand normalisation keeps bare numbers (`dolo 650`) and adds `capsule` as a suffix token — see docs/phase-2.1-catalogue.md; src/engine/normalize.ts must match.
- 2026-10-16 — The 30,000-row cap is filled demo brands first, then cross-confirmed products, then source order — ids are not popularity ranked.
- 2026-10-15 — Corrupt `my_medicines` JSON comes back unconfirmed with no ingredients, not hidden — a hidden row would make a check look more complete than it is.

## Done
Tier and requirement text come from the product pack, section 3. Fill the Tier column from the pack;
only the rows the playbook names are pre-filled. Status: `todo`, `doing` or `done`.
Proof: a test name, a command output, or a manual check with the date.

| FR | Tier | Status | Proof |
|---|---|---|---|
| FR01 | | todo | |
| FR02 | | todo | |
| FR03 | | todo | |
| FR04 | | todo | |
| FR05 | | todo | |
| FR06 | | todo | |
| FR07 | | todo | |
| FR08 | | todo | |
| FR09 | | todo | |
| FR10 | | todo | |
| FR11 | | todo | |
| FR12 | | todo | |
| FR13 | P0 | todo | |
| FR14 | P1 | todo | |
| FR15 | P1 | todo | |
| FR16 | P0 | todo | |
| FR17 | | todo | |
| FR18 | | todo | |
| FR19 | | todo | |

## Free-tier limits seen on day 1
Read the real numbers from each console on the day. Do not copy them from memory.

| Service | Limit | Where I read it | Date |
|---|---|---|---|
| Supabase (Edge Functions CPU, memory, wall clock) | | | |
| Supabase (database size, auth users, pausing) | | | |
| Gemini (model name, requests per minute and per day) | | | |
| Groq (model name, requests and audio per day) | | | |
| GitHub Actions (keep-warm job) | | | |

## Open bugs

| Id | What happens | Where | Found on |
|---|---|---|---|
| R1 | UNVERIFIED on a phone: add-medicine survives restart, wipe empties user tables only | Dev panel, elder home | 2026-10-15 |
| R2 | Installed catalogue is not replaced by an app update (only by fresh install or clear data) | docs/phase-1.3-database.md | 2026-10-15 |
| R4 | Dataset LICENCES UNCONFIRMED (3 Kaggle files; two are described as scraped from 1mg). `meta.licence` says UNCONFIRMED. | DISCLOSURE.md, docs/phase-2.1-catalogue.md | 2026-10-16 |
| R5 | Catalogue is a sample: 30,000 of 146,360 usable rows; 105,939 two-ingredient rows rejected as unverified. A demo brand missing from it shows NOT IN CATALOGUE in the verify sheet. | build/verify-sheet.csv | 2026-10-16 |
| R6 | Demo list not written yet; tools/demo-brands.txt holds 10 starter examples. Nothing in the verify sheet is checked. | tools/demo-brands.txt | 2026-10-16 |
| R7 | UNVERIFIED on a phone: new catalogue needs FORCE_CATALOG_REFRESH once, then the app must find "dolo" | src/data/db.ts | 2026-10-16 |
| R3 | `expo-doctor` network checks could not run in the build sandbox; run `npm run doctor` yourself | n/a | 2026-10-15 |

## Next prompt to run
Prompt 2.2 — ingredient class file. Paste: STATE.md. Before that: confirm the three dataset licences, write your real tools/demo-brands.txt, rebuild with `--licence`, fill build/verify-sheet.csv, and commit.

## Files index

| Path | Purpose |
|---|---|
| .gitignore | Keeps secrets, builds and private strip photos out of git |
| .env.example | Names of the two public environment variables |
| STATE.md | This file: facts every new chat needs |
| DISCLOSURE.md | What existed before the event and what was built onsite |
| docs/PROMPT_LOG.md | Log of every AI prompt used, as disclosure evidence |
| docs/GIT_WORKFLOW.md | Branch, commit and tag rules |
| tools/check-secrets.sh | Fails if a secret-looking string is in the repo |
| src/data/db.ts | Db interface, PRAGMAs, versioned migrations, wipeUserData, log-code helper |
| src/data/medicinesRepo.ts | my_medicines: add, update, confirm, remove, list, clear |
| src/data/scanCacheRepo.ts | scan_cache: get, put, prune to 200 |
| src/data/catalogRepo.ts | Read-only catalogue: FTS prefix search, getById, ingredient classes |
| src/data/repositories.ts | Wires the repos to one database |
| src/hooks/useRepositories.ts | React hook for screens |
| src/data/tests/ | Repo and migration tests plus the in-memory test double |
| docs/phase-1.3-database.md | Schema, catalogue contract, refresh, phone check |
| tools/build-catalog.ts | `npm run build:catalog`: CSVs to assets/catalog.db plus rejects, excluded, verify sheet |
| tools/normalize-build.ts | Build-time brand normaliser (disclosed copy) |
| tools/catalog-parse.ts, tools/catalog-sources.ts | Ingredient, strength and form parsing; CSV readers |
| tools/demo-brands.txt | The brands I will demo (starter examples for now) |
| tests/tools/ | Normaliser, parser, full-build and bundled-catalog tests, with fixtures |
| docs/phase-2.1-catalogue.md | Inputs, safety rule, numbers, normalisation, verification, phone refresh |
