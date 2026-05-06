#!/usr/bin/env bash
# Usage:
#   ./run.sh --config /path/to/config.json
#   NB_CONFIG=/path/to/config.json ./run.sh
#
# Builds the React client then starts the Express server.
# All arguments are forwarded to server.js unchanged, so --config
# and NB_CONFIG are both supported exactly as the server expects them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Building client…"
(cd "$SCRIPT_DIR/client" && npm run build)

echo "▶ Starting server…"
exec node "$SCRIPT_DIR/server.js" "$@"
