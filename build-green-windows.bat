@echo off
setlocal EnableDelayedExpansion

echo [1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js not found. Please install Node.js 20+ first.
  pause
  exit /b 1
)

echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo npm install failed.
  pause
  exit /b 1
)

echo [3/4] Building portable green edition...
call npm run dist:green
if %errorlevel% neq 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo [4/4] Collecting output...
if not exist green-release mkdir green-release

set "FOUND_FILE="
for %%F in (dist\*.exe) do (
  if not defined FOUND_FILE (
    set "FOUND_FILE=%%~fF"
  )
)

if not defined FOUND_FILE (
  echo Cannot find built exe in dist folder.
  pause
  exit /b 1
)

copy /Y "!FOUND_FILE!" "green-release\双人冒险-绿色版.exe" >nul
if %errorlevel% neq 0 (
  echo Copy failed.
  pause
  exit /b 1
)

echo Green edition ready:
echo green-release\双人冒险-绿色版.exe
pause
