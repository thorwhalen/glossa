#!/usr/bin/env bash
# Redeploy glossa to apps.thorwhalen.com/glossa.
#
# Also updates the /phogra/ back-compat redirect so old links keep working.
#
# Run from anywhere — paths are resolved relative to this script.
# Requirements: node/npm (for the build), rsync, `kill -HUP` on the gunicorn
# master. This script is expected to run ON the thorwhalen server, not on a
# dev laptop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="/opt/tw_platform/apps/glossa/frontend"
LEGACY_TARGET="/opt/tw_platform/apps/phogra/frontend"
GUNICORN_PATTERN='tw_platform.*gunicorn.*8010'

cd "$PROJECT_DIR"

echo "==> build"
npm run build

echo "==> rsync → $TARGET"
mkdir -p "$TARGET"
rsync -a --delete dist/ "$TARGET/"

echo "==> refresh /phogra/ back-compat redirect"
mkdir -p "$LEGACY_TARGET"
# SPA-friendly redirect: path /phogra/... → /glossa/... , preserving
# sub-paths, query, and hash. meta-refresh covers no-JS, canonical tells
# crawlers where the app really lives.
cat > "$LEGACY_TARGET/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Redirecting to glossa…</title>
    <link rel="canonical" href="https://apps.thorwhalen.com/glossa/" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=/glossa/" />
    <script>
      (function () {
        var p = location.pathname.replace(/^\/phogra(\/|$)/, '/glossa$1');
        location.replace(p + location.search + location.hash);
      })();
    </script>
  </head>
  <body>
    <p>This app moved to <a href="/glossa/">/glossa/</a>.</p>
  </body>
</html>
EOF

# HUP is safe here: we only changed static frontend files, the venv is
# untouched. If this script ever starts `pip install`-ing anything into
# /opt/tw_platform/venv/, swap HUP for `systemctl restart enlace-backend`
# — HUP'd workers inherit the master's in-memory sys.path and can fail
# with ModuleNotFoundError after a venv rewrite.
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
status=$(curl -sS -o /dev/null -w "%{http_code}" https://apps.thorwhalen.com/glossa/)
if [[ "$status" != "200" ]]; then
  echo "ERROR: /glossa/ returned HTTP $status" >&2
  exit 1
fi
echo "    /glossa/ → 200 OK"
legacy_status=$(curl -sS -o /dev/null -w "%{http_code}" https://apps.thorwhalen.com/phogra/)
echo "    /phogra/ → HTTP $legacy_status (redirect stub)"
echo
echo "Deployed: https://apps.thorwhalen.com/glossa/"
