# DISCLOSURE.md

**Rule.** The event allows pre-existing libraries, tools, designs, datasets and foundations only when
they are disclosed. Anything not listed below that was written before 24 October counts as undisclosed
and can lead to disqualification. If you are unsure whether something may be prepared early, ask the
organisers before you build it. Every item below must also be traceable in git: the `pre-event` tag
marks what existed before travel, and `p0-freeze` marks the hour-14 state.

## Pre-existing (prepared before the event)

| Item | Kind | Source or licence | Created on | Phase |
|---|---|---|---|---|
| Accounts and API keys (Supabase, Google AI Studio, Groq, GitHub) | Accounts | Own accounts, free tiers; keys stored only in Supabase secrets | | 0 |
| Empty Supabase project and schema | Backend foundation | Own project; SQL migrations written by me with AI assistance | | 4.1 to 4.3 |
| Catalogue and ingredient-class files | Dataset | Source and licence: FILL IN before use | | 2.1, 2.2 |
| Rules JSON and EN/HI strings | Data | Written by me with AI assistance; pharmacist and Hindi review pending | | 2.3, 2.4 |
| Design tokens and wireframes | Design | Own work from the product pack | | 5.1 |
| Labelled test strips | Dataset | Own photographs of strips I own or have permission to use | | 0.2 |
| Bare Expo app | Foundation | `create-expo-app` template (MIT) | | 0 |
| Keep-warm workflow | Tooling | Own GitHub Actions file | | 4.7 |

## Built onsite

| Item | Kind | Source or licence | Built on | Phase |
|---|---|---|---|---|
| | | | | |

## AI assistance

AI chat assistants (Claude, Gemini, Groq models) were used to draft code, data and documents.
Every prompt I used is logged in `docs/PROMPT_LOG.md`, with what I pasted, what I kept and what I
changed. I ran every check myself and reviewed the output before committing it. AI assistance does not
replace the pharmacist review of the rules or the native-speaker review of the Hindi text.
