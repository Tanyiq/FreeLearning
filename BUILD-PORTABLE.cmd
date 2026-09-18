@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found.
  echo Install Node.js 20 or newer from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

echo [2/4] Checking pnpm...
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is not on PATH. It will be run temporarily through npx.
  set "USE_NPX_PNPM=1"
)

set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

echo [3/4] Installing dependencies...
if defined USE_NPX_PNPM (
  call npx --yes pnpm@11 install
) else (
  call pnpm install
)
if errorlevel 1 goto :failed

echo [4/4] Building portable EXE...
if defined USE_NPX_PNPM (
  call npx --yes pnpm@11 run package:portable
) else (
  call pnpm run package:portable
)
if errorlevel 1 goto :failed

echo.
echo Build completed successfully.
echo Output: %~dp0release\Domain-Agent-Workbench-[version]-x64.exe
start "" "%~dp0release"
exit /b 0

:failed
echo.
echo Build failed. Review the error above.
pause
exit /b 1
