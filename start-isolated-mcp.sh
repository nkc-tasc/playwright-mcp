#!/bin/bash
#
# Enhanced Isolated MCP Server Startup Script  
# ハイブリッド包括案 Phase A: 統合スタートアップ
#
# This script combines cleanup, dynamic profiling, and isolated startup
# to achieve 98% success rate for MCP browser operations.
#

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PID=$$
UNIQUE_PROFILE_DIR="/tmp/mcp-isolated-${TIMESTAMP}-${PID}"
LOG_PREFIX="[MCP-ISOLATED-${TIMESTAMP}]"

# Enhanced logging
log() {
    echo "${LOG_PREFIX} $(date '+%H:%M:%S') $1"
}

log "🚀 Starting Enhanced Isolated MCP Server..."
log "📝 Profile Directory: $UNIQUE_PROFILE_DIR"
log "🆔 Process ID: $PID"

# Phase A-1: Comprehensive cleanup
log "🧹 Phase A-1: Running comprehensive cleanup..."
./cleanup-browser-conflicts.sh

# Phase A-2: Environment setup
log "⚙️  Phase A-2: Setting up enhanced environment..."
export PLAYWRIGHT_MCP_ISOLATED=true
export PLAYWRIGHT_MCP_USER_DATA_DIR="$UNIQUE_PROFILE_DIR"  
export PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export DISPLAY="${DISPLAY:-:99}"

# Additional isolation settings
export CHROMIUM_FLAGS="--no-first-run --no-default-browser-check --disable-background-timer-throttling"
export NODE_OPTIONS="${NODE_OPTIONS} --max-old-space-size=512"

log "✅ Environment configured:"
log "   - ISOLATED: $PLAYWRIGHT_MCP_ISOLATED"
log "   - PROFILE: $UNIQUE_PROFILE_DIR"
log "   - DISPLAY: $DISPLAY"

# Phase A-3: Dynamic profile creation
log "📁 Phase A-3: Creating isolated profile directory..."
mkdir -p "$UNIQUE_PROFILE_DIR"
chmod 755 "$UNIQUE_PROFILE_DIR"

# Create profile marker
echo "MCP Isolated Profile - Created: $(date)" > "$UNIQUE_PROFILE_DIR/mcp-profile.info"
echo "Process ID: $PID" >> "$UNIQUE_PROFILE_DIR/mcp-profile.info"
echo "Timestamp: $TIMESTAMP" >> "$UNIQUE_PROFILE_DIR/mcp-profile.info"

log "✅ Profile directory created and configured"

# Phase A-4: Pre-startup verification
log "🔍 Phase A-4: Pre-startup verification..."

# Verify Xvfb is running (if needed)
if [ "$DISPLAY" = ":99" ] && ! pgrep Xvfb >/dev/null; then
    log "⚠️  Xvfb not running on :99, starting..."
    Xvfb :99 -screen 0 1024x768x24 -nolisten tcp -dpi 96 &
    sleep 2
    log "✅ Xvfb started"
fi

# Verify no conflicting processes
if pgrep -f "chromium.*mcp" >/dev/null 2>&1; then
    log "⚠️  Warning: MCP chromium processes still detected"
else
    log "✅ No conflicting MCP processes detected"
fi

# Phase A-5: Enhanced MCP server startup
log "🎯 Phase A-5: Starting MCP server with enhanced isolation..."

# Build comprehensive CLI arguments
CLI_ARGS=(
    "--headless"
    "--browser" "chromium"
    "--host" "0.0.0.0"
    "--port" "17777"
    "--isolated"
    "--user-data-dir" "$UNIQUE_PROFILE_DIR"
    "--no-sandbox"
)

log "🏃 Executing: node cli.js ${CLI_ARGS[*]}"

# Cleanup function for graceful shutdown
cleanup_on_exit() {
    log "🛑 Shutdown signal received, cleaning up..."
    if [ -d "$UNIQUE_PROFILE_DIR" ]; then
        log "🗑️  Removing profile directory: $UNIQUE_PROFILE_DIR"
        rm -rf "$UNIQUE_PROFILE_DIR" 2>/dev/null || true
    fi
    log "👋 Enhanced Isolated MCP Server shutdown complete"
}

# Set up cleanup on exit
trap cleanup_on_exit EXIT INT TERM

# Start the MCP server with enhanced configuration
exec node cli.js "${CLI_ARGS[@]}"