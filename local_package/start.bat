@echo off
echo ============================================
echo   DOME CITY CONTROLLER - STARTING...
echo ============================================
echo.

REM Auto-detect port if not specified
set SERIAL_PORT=%1

if "%SERIAL_PORT%"=="" (
    echo Serial Port: Auto-detect
) else (
    echo Serial Port: %SERIAL_PORT%
)

echo Dashboard:   http://localhost:8002
echo.
echo Press Ctrl+C to stop
echo ============================================
echo.

cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8002
