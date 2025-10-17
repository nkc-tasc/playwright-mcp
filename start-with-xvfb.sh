#!/bin/bash
# Ultra-Simplified Playwright MCP with Xvfb startup script
# Root cause fix: Remove all unnecessary complexity

set -e

echo "🚀 Playwright MCP with Xvfb starting (ultra-simplified)..."

# ⚡ MINIMAL environment setup
export DISPLAY=${DISPLAY:-:99}
export LIBGL_ALWAYS_INDIRECT=1
export LIBGL_ALWAYS_SOFTWARE=1

# 🛡️ Disable dbus to avoid conflicts
export DBUS_SESSION_BUS_ADDRESS="disabled"
export DBUS_SYSTEM_BUS_ADDRESS="disabled"

# 🖥️ Start Xvfb in background 
if [ ! -z "$DISPLAY" ]; then
    echo "🖥️ Starting Xvfb on $DISPLAY..."
    
    # Clean up any existing lock files
    rm -f /tmp/.X*-lock 2>/dev/null || true
    
    # ⚡ Start Xvfb with minimal configuration
    Xvfb $DISPLAY -ac -screen 0 1920x1080x24 -dpi 96 +extension GLX +render -noreset 2>/dev/null &
    XVFB_PID=$!
    echo "✅ Xvfb started with PID: $XVFB_PID"
    
    # Basic wait for Xvfb initialization
    sleep 2
    
    echo "✅ Xvfb initialization complete"
else
    echo "ℹ️ Xvfb not needed"
fi

echo "✅ Ultra-simplified initialization complete"

# 🚀 Start the main application with clean environment
echo "🚀 Starting Playwright MCP server..."
exec "$@"