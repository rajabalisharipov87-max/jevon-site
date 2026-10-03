@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js 22.13 or later is required.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<13))process.exit(1)"
if errorlevel 1 exit /b 1
pushd "%~dp0jevon-order-status"
if errorlevel 1 exit /b 1
if not exist "node_modules\pg\package.json" (
  call npx --yes pnpm@11.25.0 install --frozen-lockfile
  if errorlevel 1 goto failed
)
echo JEVON - orders, employees and attendance
echo Orders:     http://127.0.0.1:8080
echo Attendance: http://127.0.0.1:8080/attendance
echo Employees:  http://127.0.0.1:8080/employees
echo Keep this window open. Press Ctrl+C to stop.
node -e "const net=require('node:net');const s=net.connect({host:'127.0.0.1',port:8080});s.setTimeout(1500);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>{s.destroy();process.exit(1)})"
if not errorlevel 1 (
  echo Port 8080 is already in use. Open http://127.0.0.1:8080 .
  popd
  exit /b 0
)
node scripts/run-local.mjs dev
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
:failed
echo Error: dependency installation failed.
popd
pause
exit /b 1
