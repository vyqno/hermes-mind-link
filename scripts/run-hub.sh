#!/usr/bin/env bash
# Run hub locally (dev). For real friends, put this on a VPS with HTTPS reverse proxy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${MINDLINK_HUB_DATA:-$ROOT/hub-data}"
HOST="${MINDLINK_HUB_HOST:-0.0.0.0}"
PORT="${MINDLINK_HUB_PORT:-8787}"
exec python3 "$ROOT/hub/server.py" --host "$HOST" --port "$PORT" --data "$DATA"
