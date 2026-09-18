@echo off
setlocal
cd /d "%~dp0"

for %%F in ("release\Domain-Agent-Workbench-*-x64.exe") do (
  if exist "%%~fF" (
    start "" "%%~fF"
    exit /b 0
  )
)

if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)

echo Domain Agent Workbench is not built yet.
echo Run: npm install
echo Then: npm run package:portable
pause
exit /b 1
