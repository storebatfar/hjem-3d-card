#!/usr/bin/env bash
# Usage: scripts/privacy-check.sh <words-file>
# Fails if any listed word occurs in a tracked file (including dist/). Numbers match as whole numbers.
# The list lives outside the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
while IFS= read -r w || [ -n "$w" ]; do
  # Trim surrounding whitespace and \r
  w="${w#"${w%%[![:space:]]*}"}"
  w="${w%"${w##*[![:space:]]}"}"
  w="${w//$'\r'/}"
  [ -z "$w" ] && continue
  if [[ "$w" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    # Number: match as whole number with word boundaries
    escaped="${w//./\\.}"
    set +e
    git grep -n -E "(^|[^0-9.])${escaped}([^0-9]|$)" >/dev/null 2>&1
    code=$?
    set -e
    if [ "$code" -eq 0 ]; then
      echo "FOUND: $w"; git grep -n -E "(^|[^0-9.])${escaped}([^0-9]|$)" | head -3; status=1
    elif [ "$code" -gt 1 ]; then
      echo "ERROR: git grep failed with exit code $code for pattern: $w" >&2; exit "$code"
    fi
  else
    # Text: case-insensitive fixed-string match
    set +e
    git grep -n -i -F -e "$w" >/dev/null 2>&1
    code=$?
    set -e
    if [ "$code" -eq 0 ]; then
      echo "FOUND: $w"; git grep -n -i -F -e "$w" | head -3; status=1
    elif [ "$code" -gt 1 ]; then
      echo "ERROR: git grep failed with exit code $code for word: $w" >&2; exit "$code"
    fi
  fi
done < "$1"
[ "$status" -eq 0 ] && echo "privacy check: clean"
exit "$status"
