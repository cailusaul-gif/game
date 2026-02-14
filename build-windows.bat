@echo off
setlocal

echo [1/3] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js not found. Please install Node.js 20+ first.
  pause
  exit /b 1
)

echo [2/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo npm install failed.
  pause
  exit /b 1
)

echo [3/3] Building Windows portable package...
call npm run dist:win
if %errorlevel% neq 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo Done. Output folder: dist
pause
