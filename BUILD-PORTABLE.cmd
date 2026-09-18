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

set "DEPS_READY=1"
if not exist "node_modules\electron\dist\electron.exe" set "DEPS_READY="
if not exist "node_modules\node-pty\prebuilds\win32-x64\pty.node" set "DEPS_READY="
if not exist "node_modules\electron-builder\out\cli\cli.js" set "DEPS_READY="
if not exist "node_modules\typescript\bin\tsc" set "DEPS_READY="
if defined FORCE_INSTALL set "DEPS_READY="

if defined DEPS_READY (
  echo [3/4] Dependencies are ready. Skipping network install.
) else (
  echo [3/4] Installing missing dependencies from the official source...
  set "ELECTRON_MIRROR="
  set "ELECTRON_BUILDER_BINARIES_MIRROR="
  if exist "node_modules\electron\dist\electron.exe" set "ELECTRON_SKIP_BINARY_DOWNLOAD=1"
  if defined USE_NPX_PNPM (
    call npx --yes pnpm@11 install
  ) else (
    call pnpm install
  )
  if errorlevel 1 (
    echo.
    echo Official download failed. Retrying with the Electron China mirror...
    set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
    if defined USE_NPX_PNPM (
      call npx --yes pnpm@11 install
    ) else (
      call pnpm install
    )
    if errorlevel 1 goto :download_failed
  )
)

echo [4/4] Building portable EXE...
set "ELECTRON_BUILDER_BINARIES_MIRROR="
if defined USE_NPX_PNPM (
  call npx --yes pnpm@11 run package:portable
) else (
  call pnpm run package:portable
)
if errorlevel 1 (
  echo.
  echo Official builder download failed. Retrying with the China mirror...
  set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
  if defined USE_NPX_PNPM (
    call npx --yes pnpm@11 run package:portable
  ) else (
    call pnpm run package:portable
  )
  if errorlevel 1 goto :download_failed
)

echo.
echo Build completed successfully.
echo Output: %~dp0release\Domain-Agent-Workbench-[version]-x64.exe
start "" "%~dp0release"
exit /b 0

:download_failed
echo.
echo Both the official download and the fallback mirror failed.
echo You can build on GitHub instead: Actions - Build Windows Portable EXE - Run workflow.
pause
exit /b 1

:failed
echo.
echo Build failed. Review the error above.
pause
exit /b 1
