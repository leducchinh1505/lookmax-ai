@echo off
setlocal
title Lookmax AI
REM Lookmax AI - chay ban production tren may tai http://localhost:4173
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 goto :nonode

if exist "node_modules\" goto :assets
echo [1/3] Cai dat thu vien - lan dau, can Internet...
call npm install
if errorlevel 1 goto :err

:assets
if exist "public\models\face_landmarker.task" goto :build
echo [2/3] Tai mo hinh MediaPipe - lan dau, can Internet...
call npm run setup:assets
if errorlevel 1 goto :err

:build
if exist "dist\index.html" goto :run
echo [3/3] Build ung dung...
call npm run build
if errorlevel 1 goto :err

:run
echo.
echo Lookmax AI dang chay tai http://localhost:4173
echo Giu cua so nay mo trong khi dung app. Dong cua so de tat.
echo.
start "" "http://localhost:4173"
call npx vite preview --port 4173 --strictPort
if errorlevel 1 goto :err
goto :eof

:nonode
echo Khong tim thay Node.js. Hay cai Node.js LTS tu https://nodejs.org roi chay lai.
pause
goto :eof

:err
echo.
echo Co loi xay ra - xem thong bao o tren.
echo Neu cong 4173 dang bi dung, hay dong cua so Lookmax AI cu roi thu lai.
pause
