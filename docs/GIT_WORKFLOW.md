# Git workflow

- Branches: `main` (always runs), `phase-N-short-name` for work; merge to `main` when the check passes.
- Commit format: `phase-N: what` (example: `phase-1: skeleton`).
- Run `bash tools/check-secrets.sh` before every push; the repo is public by submission.
- Tag `pre-event` just before travel: it is the evidence of what existed before 24 October.
- Tag `p0-freeze` at hour 14, when every P0 acceptance check has passed.
- Tag `submission` on the final commit you submit, and push tags with `git push --tags`.
- Never commit `.env`, keystores or anything in `private-strips/`.
