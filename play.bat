@echo off
echo ===================================================
echo   CYBERDROP: NEO-TOKYO COURIER // 2077
echo   Starting local server and launching browser...
echo ===================================================
start "" "http://localhost:8000"
python -m http.server 8000
