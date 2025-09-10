#!/bin/bash
# Simplified Playwright MCP with Xvfb startup script

set -e

echo "🚀 Playwright MCP with Xvfb starting (simplified)..."

# 基本的な環境変数設定
export DISPLAY=${DISPLAY:-:99}
export LIBGL_ALWAYS_INDIRECT=1
export LIBGL_ALWAYS_SOFTWARE=1

# dbus関連エラーを無視するための環境変数
export DBUS_SESSION_BUS_ADDRESS="disabled"
export DBUS_SYSTEM_BUS_ADDRESS="disabled"
export CHROME_DBUS_IGNORE_ERRORS=1

# Chrome固有の環境変数設定（タイムアウト対策）
export CHROME_DEVEL_SANDBOX=/usr/local/sbin/chrome-devel-sandbox
export CHROME_NO_SANDBOX=1
export PLAYWRIGHT_BROWSER_TIMEOUT=300000
export PLAYWRIGHT_LAUNCH_TIMEOUT=300000

# Start Xvfb in background (simplified)
if [ ! -z "$DISPLAY" ]; then
    echo "🖥️ Starting Xvfb on $DISPLAY..."
    
    # Clean up any existing lock files
    rm -f /tmp/.X*-lock 2>/dev/null || true
    
    # Start Xvfb (ignore errors and continue)
    Xvfb $DISPLAY -ac -screen 0 1920x1080x24 -dpi 96 +extension GLX +render -noreset 2>/dev/null &
    XVFB_PID=$!
    echo "✅ Xvfb started with PID: $XVFB_PID"
    
    # Wait for Xvfb to initialize
    sleep 3
    
    echo "✅ Xvfb initialization complete"
else
    echo "ℹ️ Xvfb not needed"
fi

echo "✅ 簡素化初期化完了"

# Start the main application
echo "🚀 Starting Playwright MCP server..."
exec "$@"