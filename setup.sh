#!/usr/bin/env bash
# setup.sh — one-shot installer. Run once, everything ready.
#
# Installs: Python venv + deps, Node deps, Playwright Chromium, profiles.json.
# Idempotent: re-run anytime to refresh deps.

set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$1"; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "Required: $1 (install it first, then re-run)"
}

step "Checking prerequisites"
need git
need python3
PY_VER=$(python3 -c 'import sys; print(".".join(map(str,sys.version_info[:2])))')
ok "python3 $PY_VER"

if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version)
  ok "node $NODE_VER"
  HAVE_NODE=1
else
  warn "node not found — Node CLI will be unavailable (Python CLI still works)"
  HAVE_NODE=0
fi

step "Setting up Python environment"
cd "$ROOT/python"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  ok "Created .venv"
else
  ok "Using existing .venv"
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --disable-pip-version-check --upgrade pip >/dev/null 2>&1 || true
pip install --quiet --disable-pip-version-check -r requirements.txt
ok "Python deps installed (playwright, faker)"

step "Installing Playwright Chromium (~200MB first time)"
python -m playwright install chromium >/dev/null 2>&1
ok "Chromium ready"

if [ "$HAVE_NODE" = "1" ]; then
  step "Installing Node deps"
  cd "$ROOT/playwright"
  if [ ! -d node_modules ]; then
    npm install --silent --no-fund --no-audit
    ok "Node deps installed"
  else
    ok "node_modules exists (skipping; run 'npm install' in playwright/ to refresh)"
  fi
fi

step "Generating profile data"
cd "$ROOT"
if [ -f profiles.json ]; then
  warn "profiles.json already exists — keeping it (delete manually to regenerate)"
else
  cd "$ROOT/python"
  source .venv/bin/activate
  python gen-profiles.py --out "$ROOT/profiles.json"
  ok "Generated 10 US profiles at profiles.json"
fi

cat <<DONE

$(printf '\033[1;32m━━━ Setup complete ━━━\033[0m')

Quick start:
  ./autofill <url>                         # fill a form (default profile)
  ./autofill <url> --submit                # fill + submit
  ./autofill <url> --profile us_05         # pick another profile
  ./autofill --help                        # full flags

Other delivery methods (see TUTORIAL.md for details):
  • Chrome extension:  chrome://extensions → Developer mode → Load unpacked → ./extension
  • Tampermonkey:      open userscript/autofill.user.js
  • Bookmarklet:       node bookmarklet/build.js && open bookmarklet/dist/install.html

Tutorial lengkap: TUTORIAL.md
DONE
