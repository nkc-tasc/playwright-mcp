#!/usr/bin/env bash
set -euo pipefail

echo "[MCP] Cleanup: removing potential browser conflicts"

# Kill common browser processes (best-effort)
for name in chromium chromium-browser chrome google-chrome msedge playwright; do
  pkill -9 -f "$name" 2>/dev/null || true
done

# Remove temp profiles and locks
rm -rf /tmp/mcp-* /tmp/playwright-* /tmp/.ms-playwright* 2>/dev/null || true
rm -f /tmp/.X*-lock 2>/dev/null || true

echo "[MCP] Cleanup complete"

