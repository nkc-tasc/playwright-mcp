#!/bin/bash
# Playwright MCP with Xvfb startup script (汎用的ヘッドレス環境対応)

set -e

echo "🚀 Playwright MCP with Xvfb starting..."

# 汎用的システム初期化：dbus初期化とクリーンアップ
echo "🔧 システム初期化開始..."

# セッションdbus初期化（汎用的コンテナ環境対応）
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
    echo "🔧 dbus session bus 初期化..."
    eval $(dbus-launch --sh-syntax) || echo "⚠️ dbus session 起動をスキップ"
    export DBUS_SESSION_BUS_ADDRESS
fi

# X11 環境変数設定（汎用的デフォルト）
export DISPLAY=${DISPLAY:-:99}
export LIBGL_ALWAYS_INDIRECT=1
export LIBGL_ALWAYS_SOFTWARE=1

# X11 lockファイルクリーンアップ（競合エラー防止）
DISPLAY_NUM=${DISPLAY#:}
X_LOCK_FILE="/tmp/.X${DISPLAY_NUM}-lock"
if [ -f "$X_LOCK_FILE" ]; then
    echo "🔧 既存X11 lockファイル削除: $X_LOCK_FILE"
    rm -f "$X_LOCK_FILE" || echo "⚠️ lockファイル削除失敗（権限問題の可能性）"
fi

# 既存Xvfbプロセス終了（汎用的クリーンアップ）
if pgrep -f "Xvfb.*$DISPLAY" > /dev/null; then
    echo "🔧 既存Xvfbプロセス終了: $DISPLAY"
    pkill -f "Xvfb.*$DISPLAY" || echo "⚠️ 既存プロセス終了失敗"
    sleep 2
fi

# Start Xvfb in background if DISPLAY is set but Xvfb is not running
if [ ! -z "$DISPLAY" ] && ! pgrep -f "Xvfb.*$DISPLAY" > /dev/null; then
    echo "🖥️ Starting Xvfb on $DISPLAY..."
    Xvfb $DISPLAY -ac -screen 0 1920x1080x24 -dpi 96 +extension GLX +render -noreset &
    XVFB_PID=$!
    echo "✅ Xvfb started with PID: $XVFB_PID"
    
    # Wait a moment for Xvfb to initialize
    sleep 3
    
    # Verify Xvfb is running
    if pgrep -x "Xvfb" > /dev/null; then
        echo "✅ Xvfb is running successfully"
        
        # 汎用的X11接続確認
        if command -v xdpyinfo >/dev/null 2>&1; then
            if xdpyinfo -display $DISPLAY >/dev/null 2>&1; then
                echo "✅ X11 connection verified"
            else
                echo "⚠️ X11 connection test failed, continuing anyway"
            fi
        fi
    else
        echo "❌ Failed to start Xvfb"
        exit 1
    fi
else
    echo "ℹ️ Xvfb not needed or already running"
fi

echo "✅ システム初期化完了"

# Start the main application
echo "🚀 Starting Playwright MCP server..."
exec "$@"