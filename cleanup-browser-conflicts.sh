#!/usr/bin/env bash
#
# Browser Conflict Resolution Script for Playwright MCP
# ハイブリッド包括案 Phase A-1: プロセスクリア機能
#
# This script performs comprehensive cleanup of browser processes, 
# profiles, and caches to prevent instance conflicts.
#

set -e

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🧹 Starting comprehensive browser conflict cleanup..."

# Phase 1: Process termination
log "📋 Phase 1: Terminating potentially conflicting processes"
for process in chromium chromium-browser chrome google-chrome msedge playwright; do
    if pgrep -f "$process" >/dev/null 2>&1; then
        log "  🔄 Terminating $process processes..."
        pkill -f "$process" 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if pgrep -f "$process" >/dev/null 2>&1; then
            log "  ⚠️  Force killing $process processes..."
            pkill -9 -f "$process" 2>/dev/null || true
            sleep 1
        fi
    else
        log "  ✅ No $process processes found"
    fi
done

# Phase 2: Cache and profile cleanup
log "📋 Phase 2: Cleaning caches and profiles"

# Common cache directories to clean
CACHE_DIRS=(
    "/tmp/mcp-*"
    "/tmp/playwright-*" 
    "/tmp/.ms-playwright*"
    "/root/.cache/ms-playwright/mcp-*"
    "/home/*/.cache/ms-playwright/mcp-*"
    "~/.cache/ms-playwright/mcp-*"
)

for cache_pattern in "${CACHE_DIRS[@]}"; do
    if ls $cache_pattern >/dev/null 2>&1; then
        log "  🗑️  Removing: $cache_pattern"
        rm -rf $cache_pattern 2>/dev/null || true
    else
        log "  ✅ No cache found: $cache_pattern"
    fi
done

# Phase 3: Socket and lock file cleanup
log "📋 Phase 3: Cleaning socket and lock files"
LOCK_PATTERNS=(
    "/tmp/.X*lock"
    "/tmp/.chromium-*"
    "/tmp/.playwright-*"
    "/var/tmp/.ms-playwright-*"
)

for lock_pattern in "${LOCK_PATTERNS[@]}"; do
    if ls $lock_pattern >/dev/null 2>&1; then
        log "  🔐 Removing locks: $lock_pattern"
        rm -f $lock_pattern 2>/dev/null || true
    fi
done

# Phase 4: Shared memory cleanup  
log "📋 Phase 4: Cleaning shared memory segments"
if [ -d "/dev/shm" ]; then
    find /dev/shm -name "*chromium*" -o -name "*playwright*" -o -name "*mcp*" | while read shmfile; do
        if [ -f "$shmfile" ] || [ -d "$shmfile" ]; then
            log "  🧠 Removing shared memory: $shmfile"
            rm -rf "$shmfile" 2>/dev/null || true
        fi
    done
fi

# Phase 5: Final verification wait
log "📋 Phase 5: Final verification and stabilization"
sleep 2

# Verify no conflicting processes remain
REMAINING_PROCESSES=$(pgrep -f "chromium|chrome|playwright" 2>/dev/null || true)
if [ -n "$REMAINING_PROCESSES" ]; then
    log "  ⚠️  Warning: Some processes still running: $REMAINING_PROCESSES"
else
    log "  ✅ All conflicting processes terminated"
fi

log "🎉 Browser conflict cleanup completed successfully"
log "📊 System ready for isolated MCP server startup"