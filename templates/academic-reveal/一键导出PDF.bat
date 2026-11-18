@echo off
rem Export the existing output/index.html to ../presentation.pdf.
rem This does not rebuild slides.yaml. Run the build bat first when content changes.
rem Keep this file ASCII-only because cmd may use an ANSI codepage.
pushd "%~dp0..\.." || (echo [ERROR] cannot enter repo root & pause & exit /b 1)
where node >nul 2>nul || (
  echo [ERROR] node not found in PATH. Install Node.js or add it to PATH.
  pause
  popd
  exit /b 1
)
node "src\academic-presentation\export_pdf.mjs" "%~dp0."
if errorlevel 1 (
  echo.
  echo [FAIL] PDF export error - see message above.
  pause
  popd
  exit /b 1
)
echo [OK] %~dp0presentation.pdf
popd
exit /b 0
