@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then open START.cmd again.
  pause
  exit /b 1
)
if not exist "node_modules\three\build\three.module.js" (
  call npm install --cache ".npm-cache" --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo TRAILBOUND local test: http://127.0.0.1:8790
echo Keep this window open while playing. Ctrl+C stops the game server.
echo No public deployment is created.
echo.
node server.mjs
pause
