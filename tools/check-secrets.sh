#!/usr/bin/env bash
# Fails (exit 1) if any tracked or not-yet-ignored file contains a secret-looking string.
# Works on Git Bash (Windows), macOS and Linux. Run from anywhere inside the repo.
#
# Patterns: Google API key prefix, OpenAI-style key, Groq key prefix, Supabase secret key
# prefix, the service-role name, and JWT-like strings starting with eyJ.
# The OpenAI-style pattern needs a non-letter before it and 8+ characters after it, so words
# such as "task-list" or "risk-based" do not trigger it.
#
# Output prints only file names and line numbers, never the matching text,
# so running this script cannot leak a secret into a terminal log.

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "check-secrets: not inside a git repository." >&2
  exit 2
}
cd "$ROOT" || exit 2

SELF="tools/check-secrets.sh"
PATTERN='AIza[0-9A-Za-z_-]+|(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9_]+|sb_secret_[A-Za-z0-9_-]*|service_role|eyJ[A-Za-z0-9_-]{10,}'

found=0
checked=0

# Tracked files plus untracked files that are not ignored (so a new file is caught before commit).
while IFS= read -r -d '' f; do
  [ "$f" = "$SELF" ] && continue
  [ -f "$f" ] || continue
  checked=$((checked + 1))
  hits="$(grep -I -n -E -e "$PATTERN" -- "$f" | cut -d: -f1 | tr '\n' ' ')"
  if [ -n "$hits" ]; then
    echo "SECRET-LIKE TEXT: $f (line(s): $hits)"
    found=1
  fi
done < <(git ls-files --cached --others --exclude-standard -z)

if [ "$found" -ne 0 ]; then
  echo "check-secrets: FAILED. Remove the text, and if a real key was ever committed, rotate that key first."
  exit 1
fi

echo "check-secrets: OK ($checked files checked)."
exit 0
