#!/usr/bin/env bash
# Local dual-mind pilot notes (does not expose ports publicly).
set -euo pipefail
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
echo "=== Hermes Mind-link local pilot ==="
echo "This script prints the checklist and creates a profile if missing."
echo ""
if ! command -v hermes >/dev/null 2>&1; then
  echo "hermes CLI not found on PATH"; exit 1
fi

if ! hermes profile list 2>/dev/null | grep -q mind-harshal; then
  echo "Creating profile mind-harshal (fresh)..."
  hermes profile create mind-harshal --clone default 2>/dev/null \
    || hermes profile create mind-harshal 2>/dev/null \
    || echo "(create manually: hermes profile create mind-harshal)"
else
  echo "Profile mind-harshal already listed."
fi

cat <<EOF

Manual A2A dual-port sketch (localhost only):

  # Terminal A — your default mind inbound
  A2A_PEER_TOKENS=pilot:\$(openssl rand -hex 16)
  # put token in ~/.hermes/.env
  hermes config set gateway.platforms.a2a.enabled true
  # port 9900 default

  # Terminal B — pilot mind (separate HERMES_HOME or profile multiplex)
  # HERMES_HOME=~/.hermes/profiles/mind-harshal
  # A2A_PORT=9901
  # Cross-list each other under a2a_agents with bearer tokens

  # From Telegram to your bot:
  # "Ping pilot-harshal's agent with: hello from mind-link pilot"
  # Expect clarify → a2a_call → reply

Security: keep A2A_HOST=127.0.0.1 until you use Tailscale + tokens.

EOF
