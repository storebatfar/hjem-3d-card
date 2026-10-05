#!/usr/bin/env bash
# Copies the private house description (kept outside the repo) into the git-ignored harness folder.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p private
cp "$HOME/private/HAOS/docs/hjem-3d/house.json" private/house.json
echo "synced private/house.json"
