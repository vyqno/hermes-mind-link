#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
ML="$HERMES_HOME/mind-link"
SKILL_DST="$HERMES_HOME/skills/autonomous-ai-agents/mind-link"

mkdir -p "$ML" "$SKILL_DST/references"

cp -R "$ROOT/skill/mind-link/." "$SKILL_DST/"
cp "$ROOT/templates/trust.yaml" "$ML/trust.yaml.example"
if [[ ! -f "$ML/trust.yaml" ]]; then
  cp "$ROOT/templates/trust.yaml" "$ML/trust.yaml"
  chmod 600 "$ML/trust.yaml" || true
fi
cp "$ROOT/templates/a2a_agents.snippet.yaml" "$ML/a2a_agents.snippet.yaml" 2>/dev/null || true
cp "$ROOT/templates/SOUL.mind-link.md" "$ML/SOUL.mind-link.md" 2>/dev/null || true

# Install CLI into Hermes venv when present
if [[ -x "$HERMES_HOME/hermes-agent/venv/bin/pip" ]]; then
  "$HERMES_HOME/hermes-agent/venv/bin/pip" install -e "$ROOT" -q || true
elif command -v pip3 >/dev/null 2>&1; then
  pip3 install -e "$ROOT" --user -q 2>/dev/null || pip3 install -e "$ROOT" -q 2>/dev/null || true
fi

# Default hub URL if missing
ENVF="$HERMES_HOME/.env"
touch "$ENVF"
if ! grep -q '^MINDLINK_HUB_URL=' "$ENVF" 2>/dev/null; then
  echo 'MINDLINK_HUB_URL=https://hermes-mind-link.vyqno-xyz.workers.dev' >> "$ENVF"
fi

echo ""
echo "Mind-link installed → $HERMES_HOME"
echo "Next (once per machine):"
echo "  mind-link connect"
echo "Then restart Hermes gateway / open a new chat and work normally."
echo "Agents mesh via hub; work instincts only by default."
