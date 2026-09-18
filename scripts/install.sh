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
  echo "Created $ML/trust.yaml — edit self.agent_id and links."
else
  echo "Kept existing $ML/trust.yaml (example at trust.yaml.example)"
fi

cp "$ROOT/templates/a2a_agents.snippet.yaml" "$ML/a2a_agents.snippet.yaml"
cp "$ROOT/templates/SOUL.mind-link.md" "$ML/SOUL.mind-link.md"
cp "$ROOT/docs/instinct-vs-open-agents.md" "$ML/instinct-vs-open-agents.md" 2>/dev/null || true

# optional pip install for CLI
if command -v pip3 >/dev/null 2>&1; then
  pip3 install -e "$ROOT" --quiet 2>/dev/null || pip3 install -e "$ROOT" --user --quiet || true
fi

echo ""
echo "Mind-link installed into $HERMES_HOME"
echo "Next:"
echo "  1. Edit $ML/trust.yaml"
echo "  2. hermes tools enable a2a --platform telegram"
echo "  3. Append $ML/SOUL.mind-link.md into your SOUL.md (optional)"
echo "  4. mind-link validate   # if CLI installed"
echo "  5. Restart gateway / new chat so skill loader sees mind-link"
