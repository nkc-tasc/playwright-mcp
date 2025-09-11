#!/usr/bin/env bash
set -euo pipefail

echo "[MCP] Integrated startup sequence beginning..."

export DISPLAY=${DISPLAY:-:99}
export LIBGL_ALWAYS_INDIRECT=1
export LIBGL_ALWAYS_SOFTWARE=1
export DBUS_SESSION_BUS_ADDRESS="disabled"
export DBUS_SYSTEM_BUS_ADDRESS="disabled"

echo "[MCP] Starting Xvfb on ${DISPLAY}"
rm -f /tmp/.X*-lock 2>/dev/null || true
Xvfb "${DISPLAY}" -ac -screen 0 1920x1080x24 -dpi 96 +extension GLX +render -noreset 2>/dev/null &
XVFB_PID=$!
sleep 2
echo "[MCP] Xvfb PID: ${XVFB_PID}"

# Default CLI options
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-17777}
BROWSER=${BROWSER:-chromium}
HEADLESS_FLAG=${PLAYWRIGHT_MCP_HEADLESS:-true}
SANDBOX_FLAG=${PLAYWRIGHT_MCP_SANDBOX:-false}
ISOLATED_FLAG=${PLAYWRIGHT_MCP_ISOLATED:-true}
USER_DATA_DIR=${USER_DATA_DIR:-/tmp/mcp-isolated-$(date +%Y%m%d_%H%M%S)}

CMD=("node" "cli.js" "--browser" "${BROWSER}" "--host" "${HOST}" "--port" "${PORT}")
if [[ "${HEADLESS_FLAG}" == "true" ]]; then CMD+=("--headless"); fi
if [[ "${SANDBOX_FLAG}" != "true" ]]; then CMD+=("--no-sandbox"); fi
if [[ "${ISOLATED_FLAG}" == "true" ]]; then CMD+=("--isolated" "--user-data-dir" "${USER_DATA_DIR}"); fi

echo "[MCP] Launching: ${CMD[*]}"
exec "${CMD[@]}"

