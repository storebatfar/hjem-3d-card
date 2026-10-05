#!/usr/bin/env bash
# Usage: scripts/privacy-check.sh <words-file>
# Fails if any listed word occurs in a tracked file (including dist/). Numbers match as whole numbers.
# The list lives outside the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
while IFS= read -r w || [ -n "$w" ]; do
  [ -z "$w" ] && continue
  if [[ "$w" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    # Number: match as whole number with word boundaries
    escaped="${w//./\\.}"
    if git grep -n -E "(^|[^0-9.])${escaped}([^0-9]|$)" >/dev/null 2>&1; then
      echo "FOUND: $w"; git grep -n -E "(^|[^0-9.])${escaped}([^0-9]|$)" | head -3; status=1
    fi
  else
    # Text: case-insensitive fixed-string match
    if git grep -n -i -F -e "$w" >/dev/null 2>&1; then
      echo "FOUND: $w"; git grep -n -i -F -e "$w" | head -3; status=1
    fi
  fi
done < "$1"
[ "$status" -eq 0 ] && echo "privacy check: clean"
exit "$status"
