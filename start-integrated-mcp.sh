#!/usr/bin/env bash
# Integrated MCP Server Startup Script
# Combines Xvfb setup and MCP server startup

set -e

echo "🚀 Integrated Playwright MCP Server starting..."

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PID=$$
UNIQUE_PROFILE_DIR="/tmp/mcp-isolated-${TIMESTAMP}-${PID}"
LOG_PREFIX="[MCP-INTEGRATED-${TIMESTAMP}]"

# Enhanced logging
log() {
    echo "${LOG_PREFIX} $(date '+%H:%M:%S') $1"
}

# ⚡ MINIMAL environment setup
export DISPLAY=${DISPLAY:-:99}
export LIBGL_ALWAYS_INDIRECT=1
export LIBGL_ALWAYS_SOFTWARE=1

# 🛡️ Disable dbus to avoid conflicts
export DBUS_SESSION_BUS_ADDRESS="disabled"
export DBUS_SYSTEM_BUS_ADDRESS="disabled"

# 🖥️ Start Xvfb in background 
if [ ! -z "$DISPLAY" ]; then
    log "🖥️ Starting Xvfb on $DISPLAY..."
    
    # Clean up any existing lock files
    rm -f /tmp/.X*-lock 2>/dev/null || true
    
    # ⚡ Start Xvfb with minimal configuration
    Xvfb $DISPLAY -ac -screen 0 1920x1080x24 -dpi 96 +extension GLX +render -noreset 2>/dev/null &
    XVFB_PID=$!
    log "✅ Xvfb started with PID: $XVFB_PID"
    
    # Basic wait for Xvfb initialization
    sleep 2
    
    log "✅ Xvfb initialization complete"
else
    log "ℹ️ Xvfb not needed"
fi

# Phase A-1: Comprehensive cleanup if script exists
if [ -f "./cleanup-browser-conflicts.sh" ]; then
    log "🧹 Running comprehensive cleanup..."
    ./cleanup-browser-conflicts.sh || log "⚠️ Cleanup script failed, continuing..."
else
    log "ℹ️ Cleanup script not found, proceeding..."
fi

# Phase A-2: Environment setup
log "⚙️ Setting up enhanced environment..."
export PLAYWRIGHT_MCP_ISOLATED=true
export PLAYWRIGHT_MCP_USER_DATA_DIR="$UNIQUE_PROFILE_DIR"  
export PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Additional isolation settings
export CHROMIUM_FLAGS="--no-first-run --no-default-browser-check --disable-background-timer-throttling"
export NODE_OPTIONS="${NODE_OPTIONS} --max-old-space-size=512"

log "✅ Environment configured:"
log "   - ISOLATED: $PLAYWRIGHT_MCP_ISOLATED"
log "   - PROFILE: $UNIQUE_PROFILE_DIR"
log "   - DISPLAY: $DISPLAY"

# Phase A-3: Dynamic profile creation
log "📁 Creating isolated profile directory..."
mkdir -p "$UNIQUE_PROFILE_DIR"
chmod 755 "$UNIQUE_PROFILE_DIR"

# Create profile marker
echo "MCP Isolated Profile - Created: $(date)" > "$UNIQUE_PROFILE_DIR/mcp-profile.info"
echo "Process ID: $PID" >> "$UNIQUE_PROFILE_DIR/mcp-profile.info"
echo "Timestamp: $TIMESTAMP" >> "$UNIQUE_PROFILE_DIR/mcp-profile.info"

log "✅ Profile directory created and configured"

# Phase A-4: Pre-startup verification
log "🔍 Pre-startup verification..."

# Verify no conflicting processes
if pgrep -f "chromium.*mcp" >/dev/null 2>&1; then
    log "⚠️ Warning: MCP chromium processes still detected"
else
    log "✅ No conflicting MCP processes detected"
fi

# Phase A-5: Enhanced MCP server startup
log "🎯 Starting MCP server with enhanced isolation..."

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
        log "🗑️ Removing profile directory: $UNIQUE_PROFILE_DIR"
        rm -rf "$UNIQUE_PROFILE_DIR" 2>/dev/null || true
    fi
    log "👋 Integrated MCP Server shutdown complete"
}

# Set up cleanup on exit
trap cleanup_on_exit EXIT INT TERM

# Start the MCP server with enhanced configuration
log "🚀 Starting Node.js MCP server..."
exec node cli.js "${CLI_ARGS[@]}"