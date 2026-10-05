#!/usr/bin/env bash
# Usage: scripts/privacy-check.sh <words-file>
# Fails if any listed word occurs in a tracked file (including dist/). The list lives outside the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
while IFS= read -r w || [ -n "$w" ]; do
  [ -z "$w" ] && continue
  if git grep -n -i -F -e "$w" >/dev/null 2>&1; then
    echo "FOUND: $w"; git grep -n -i -F -e "$w" | head -3; status=1
  fi
done < "$1"
[ "$status" -eq 0 ] && echo "privacy check: clean"
exit "$status"
