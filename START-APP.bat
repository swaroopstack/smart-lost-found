@echo off
setlocal EnableExtensions
title Smart Lost and Found - Launcher

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "PY=%BACKEND%\.venv\Scripts\python.exe"
set "BACKEND_URL=http://127.0.0.1:8000"
set "FRONTEND_URL=http://localhost:5173"

echo.
echo   ==================================================
echo      SMART LOST AND FOUND  -  one-click launcher
echo   ==================================================
echo.

rem ---------------------------------------------------------------
rem  Pre-flight checks
rem ---------------------------------------------------------------
if not exist "%PY%" goto :no_backend
if not exist "%FRONTEND%\node_modules" goto :no_frontend
where npm >nul 2>&1
if errorlevel 1 goto :no_npm

rem ---------------------------------------------------------------
rem  1. Backend
rem ---------------------------------------------------------------
set "BACKEND_UP="
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ((Invoke-WebRequest -UseBasicParsing -Uri '%BACKEND_URL%/health' -TimeoutSec 2).StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 set "BACKEND_UP=1"

if defined BACKEND_UP (
  echo   [1/3] Backend already running on port 8000 - reusing it.
) else (
  echo   [1/3] Starting backend on %BACKEND_URL% ...
  if not exist "%BACKEND%\slf.db" (
    echo         First run detected - creating the demo database ...
    pushd "%BACKEND%"
    "%PY%" -m scripts.seed_demo
    popd
  )
  start "Smart Lost & Found - Backend" /D "%BACKEND%" cmd /k ""%PY%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
)

echo         Waiting for the backend to answer ...
call :wait_for "%BACKEND_URL%/health" 60
if errorlevel 1 (
  echo.
  echo   ERROR: The backend did not start within 60 seconds.
  echo   Open the "Smart Lost and Found - Backend" window to see the error.
  echo.
  pause
  exit /b 1
)
echo         Backend is ready.

rem ---------------------------------------------------------------
rem  2. Frontend
rem ---------------------------------------------------------------
set "FRONTEND_UP="
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ((Invoke-WebRequest -UseBasicParsing -Uri '%FRONTEND_URL%/' -TimeoutSec 2).StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 set "FRONTEND_UP=1"

if defined FRONTEND_UP (
  echo   [2/3] Frontend already running on port 5173 - reusing it.
) else (
  echo   [2/3] Starting frontend on %FRONTEND_URL% ...
  start "Smart Lost & Found - Frontend" /D "%FRONTEND%" cmd /k "npm run dev"
)

echo         Waiting for the frontend to answer ...
call :wait_for "%FRONTEND_URL%/" 90
if errorlevel 1 (
  echo.
  echo   ERROR: The frontend did not start within 90 seconds.
  echo   Open the "Smart Lost and Found - Frontend" window to see the error.
  echo.
  pause
  exit /b 1
)
echo         Frontend is ready.

rem ---------------------------------------------------------------
rem  3. Open the app
rem ---------------------------------------------------------------
echo   [3/3] Opening the app in your browser ...
start "" "%FRONTEND_URL%/login"

echo.
echo   ==================================================
echo      READY:  %FRONTEND_URL%/login
echo   ==================================================
echo.
echo   Demo logins:
echo     Student   student@campus.edu  /  Student@123
echo     Staff     staff@campus.edu    /  Staff@123
echo     Admin     admin@campus.edu    /  Admin@123
echo.
echo   Two server windows are running:
echo     "Smart Lost and Found - Backend"
echo     "Smart Lost and Found - Frontend"
echo   Keep them open while using the app.
echo   Close BOTH of them to stop the servers.
echo.
echo   You can close this launcher window now.
echo.
pause
exit /b 0

rem ---------------------------------------------------------------
rem  Helpers
rem ---------------------------------------------------------------
:wait_for
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%~1'; $n=%~2; for($i=0;$i -lt $n;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } } catch {}; Start-Sleep -Seconds 1 }; exit 1"
if errorlevel 1 exit /b 1
exit /b 0

:no_backend
echo   ERROR: Python environment not found.
echo.
echo   Expected: %PY%
echo.
echo   Set it up once:
echo     cd backend
echo     python -m venv .venv
echo     .venv\Scripts\Activate.ps1
echo     pip install -r requirements.txt
echo.
pause
exit /b 1

:no_frontend
echo   ERROR: Frontend dependencies not found.
echo.
echo   Expected: %FRONTEND%\node_modules
echo.
echo   Set it up once:
echo     cd frontend
echo     npm install
echo.
pause
exit /b 1

:no_npm
echo   ERROR: npm was not found on PATH.
echo.
echo   Install Node.js (LTS) from https://nodejs.org and run this file again.
echo.
pause
exit /b 1
