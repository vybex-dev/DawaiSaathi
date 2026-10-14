# STATE.md — Dawai Saathi

Paste this whole file at the end of the Context Pack (after the word STATE) in every new chat.
Update it with the Handoff prompt at the end of each phase. Keep it under about 400 words of prose.

## Versions
Fill in on day 1. Write UNVERIFIED if you have not run the command.

| Tool | Version | Command to check |
|---|---|---|
| node | | `node -v` |
| npm | | `npm -v` |
| expo | | `npx expo --version` |
| react-native | | `npm ls react-native` |
| supabase CLI | | `npx supabase --version` |
| deno | | `deno --version` |
| Android Studio | | Help > About |
| Test phone model | | |
| Test phone Android version | | Settings > About phone |

## Decisions
One line each: `YYYY-MM-DD — decision — reason`.

- 2026-10-14 — Free-Claude build playbook, one fresh chat per prompt — free chats drift and have usage limits.

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
| | | | |

## Next prompt to run
Prompt 0.2 — evidence and test-strip kit. Paste: nothing extra.

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
