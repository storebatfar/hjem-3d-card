#!/usr/bin/env bash
# Renders the card in headless Chrome. Screenshots land in harness/shots/.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HOUSE="${HOUSE:-auto}"
PORT=8765 node harness/serve.js >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV' EXIT
sleep 0.6
mkdir -p harness/shots
# Raised to 15000ms because the charging flow animation runs a 66ms timer continuously in headless
FLAGS=(--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --virtual-time-budget=15000)
URL="http://127.0.0.1:8765/harness/index.html"
shot() { "$CHROME" "${FLAGS[@]}" --window-size="$3" --screenshot="harness/shots/$1.png" "$URL?$2&house=$HOUSE" >/dev/null 2>&1; echo "harness/shots/$1.png"; }
shot idle-dark   "t=0&bg=dark"                    1340,740
shot mid-dark    "t=0.5&bg=dark"                  1340,740
shot plan-dark   "t=1&bg=dark"                    1340,740
shot idle-light  "t=0&bg=light"                   1340,740
shot plan-light  "t=1&bg=light"                   1340,740
shot idle-portrait "t=0&bg=dark&height=1000px"    720,1040
shot debug-low   "t=0&bg=dark&debug&quality=low"  1340,740
shot plan-lit-dark   "t=1&bg=dark&lit=auto"            1340,740
shot idle-lit-dark   "t=0&bg=dark&lit=auto"            1340,740
shot plan-lit-light  "t=1&bg=light&lit=auto&mode=Lys"  1340,740
check() { "$CHROME" "${FLAGS[@]}" --dump-dom "$URL?$1&house=$HOUSE" 2>/dev/null | grep -o '<title>[^<]*' | sed 's/<title>//'; }
shot plan-cars-dark   "t=1&bg=dark"               1340,740
shot idle-cars-dark   "t=0&bg=dark"               1340,740
shot plan-away-dark   "t=1&bg=dark&car=away"      1340,740
echo "tap in plan:      $(check 't=1&tap=auto')"
echo "tap in idle:      $(check 't=0&tapidle=auto')"
echo "hass churn:       $(check 't=0&churn=1&charge=none')"   # idle: plan mode wakes once a second on purpose
echo "two quick taps:   $(check 't=1&tap2=auto')"
echo "tap on a wall:    $(check 't=1&tapwall=auto')"
echo "tap on a car:     $(check 't=1&tapcar=auto')"
echo "tap on grass:     $(check 't=1&tapgrass=auto')"
echo "charging:         $(check 't=1')"
echo "charge stops:     $(check 't=1&stopcharge=1')"
echo "car away:         $(check 't=1&car=away')"
echo -n "leak check: "
"$CHROME" "${FLAGS[@]}" --dump-dom "$URL?leak=1&house=$HOUSE" 2>/dev/null | grep -o 'live=[0-9]* gl=[0-9]*' || echo "no result"
