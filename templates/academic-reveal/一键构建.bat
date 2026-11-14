@echo off
rem ============================================================
rem  One-click build: compile content/slides.yaml to output/index.html
rem  Double-click to run. On success: open deck in default browser,
rem  window closes itself. On any error: window stays (pause) with reason.
rem  This file is generic: copy it into any deck folder, no edits needed.
rem  NOTE: keep this file ASCII-only (cmd parses bat in ANSI codepage).
rem ============================================================
rem Repo root = two levels up from this deck folder (pushd handles Z: and UNC paths)
pushd "%~dp0..\.." || (echo [ERROR] cannot enter repo root & pause & exit /b 1)
rem Deck name from this bat's own path (no hardcoding)
for %%I in ("%~dp0.") do set "DECK=%%~nxI"
rem Python detection: prefer python, fall back to py launcher
set "PY=python"
where python >nul 2>nul || set "PY=py"
where %PY% >nul 2>nul || (
  echo [ERROR] python not found in PATH. Install Python or add it to PATH.
  pause
  popd
  exit /b 1
)
rem Build (build.py also copies vendor / CSS / assets into output)
%PY% "src\academic-presentation\build.py" "decks\%DECK%"
if errorlevel 1 (
  echo.
  echo [FAIL] build error - see message above.
  pause
  popd
  exit /b 1
)
echo [OK] decks\%DECK%\output\index.html
popd
rem Open deck in default browser (%~dp0 = this deck folder, quote-safe)
start "" "%~dp0output\index.html"
exit /b 0
