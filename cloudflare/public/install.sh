#!/usr/bin/env bash
# Mind-link one-liner install for Hermes
# curl -fsSL https://hermes-mind-link.vyqno-xyz.workers.dev/install.sh | bash
set -euo pipefail
HUB_URL="${MINDLINK_HUB_URL:-https://hermes-mind-link.vyqno-xyz.workers.dev}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
REPO_URL="${MINDLINK_REPO:-https://github.com/vyqno/hermes-mind-link.git}"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Mind-link → Hermes home: $HERMES_HOME"
if ! command -v git >/dev/null 2>&1; then
  echo "git required" >&2
  exit 1
fi
git clone --depth 1 "$REPO_URL" "$TMP/repo" >/dev/null 2>&1
bash "$TMP/repo/scripts/install.sh"
# Prefer venv pip if Hermes has one
if [[ -x "$HERMES_HOME/hermes-agent/venv/bin/pip" ]]; then
  "$HERMES_HOME/hermes-agent/venv/bin/pip" install -e "$TMP/repo" -q || true
elif command -v pip3 >/dev/null 2>&1; then
  pip3 install -e "$TMP/repo" --user -q 2>/dev/null || true
fi

export MINDLINK_HUB_URL="$HUB_URL"
if command -v mind-link >/dev/null 2>&1; then
  echo "Run: mind-link connect"
  echo "Or non-interactive later with an existing token:"
  echo "  mind-link connect --token \"\$MINDLINK_HUB_TOKEN\""
else
  python3 -m mind_link.cli connect 2>/dev/null || \
    "$HERMES_HOME/hermes-agent/venv/bin/python" -m mind_link.cli connect 2>/dev/null || \
    echo "CLI not on PATH yet — open a new shell, then: mind-link connect"
fi
echo "Hub: $HUB_URL"
