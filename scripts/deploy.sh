#!/usr/bin/env bash
# Redeploy phogra to apps.thorwhalen.com/phogra.
#
# Run from anywhere — paths are resolved relative to this script.
# Requirements: node/npm (for the build), rsync, `kill -HUP` on the gunicorn
# master. This script is expected to run ON the thorwhalen server, not on a
# dev laptop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="/opt/tw_platform/apps/phogra/frontend"
GUNICORN_PATTERN='tw_platform.*gunicorn.*8010'

cd "$PROJECT_DIR"

echo "==> build"
npm run build

echo "==> rsync → $TARGET"
mkdir -p "$TARGET"
rsync -a --delete dist/ "$TARGET/"

echo "==> reload gunicorn (graceful HUP)"
MASTER="$(pgrep -f "$GUNICORN_PATTERN" | head -1)"
if [[ -z "$MASTER" ]]; then
  echo "ERROR: could not find gunicorn master matching '$GUNICORN_PATTERN'" >&2
  exit 1
fi
kill -HUP "$MASTER"
echo "    (sent HUP to PID $MASTER)"

echo "==> smoke test"
sleep 2
status=$(curl -sS -o /dev/null -w "%{http_code}" https://apps.thorwhalen.com/phogra/)
if [[ "$status" != "200" ]]; then
  echo "ERROR: /phogra/ returned HTTP $status" >&2
  exit 1
fi
echo "    /phogra/ → 200 OK"
echo
echo "Deployed: https://apps.thorwhalen.com/phogra/"
