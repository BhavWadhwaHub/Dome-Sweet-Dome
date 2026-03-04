@echo off
echo ============================================
echo   DOME CITY CONTROLLER - SETUP
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

echo [1/3] Installing Python dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Setup complete!
echo.
echo ============================================
echo   NEXT STEPS:
echo ============================================
echo.
echo 1. Upload arduino/dome_city_controller.ino to your Arduino UNO
echo    (Open in Arduino IDE and click Upload)
echo.
echo 2. Run 'start.bat' to launch the dashboard
echo.
echo ============================================
pause
