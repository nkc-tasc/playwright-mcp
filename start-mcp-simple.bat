@echo off
REM 簡略化されたMCPサーバー起動スクリプト
REM 既存プロセスのクリーンアップと最小設定での起動

echo [MCP-SIMPLE] MCPサーバー簡略起動開始...

REM 既存のnode.jsプロセス（ポート17777使用）をクリーンアップ  
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :17777') do (
    echo [MCP-SIMPLE] 既存プロセス %%i を停止中...
    taskkill /PID %%i /F >nul 2>&1
)

REM 短時間待機
timeout /t 2 /nobreak >nul

REM MCPサーバーを最小設定で起動
echo [MCP-SIMPLE] MCPサーバーを起動中... (ポート17777)
cd /d "%~dp0"
node cli.js --headless --isolated --port 17777 --host localhost --browser chromium --no-sandbox

pause