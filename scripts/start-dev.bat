@echo off
chcp 65001 >nul
echo ========================================
echo 암호화폐 투자 시뮬레이터 개발 서버 시작
echo ========================================
echo.

echo [1단계] Ollama 연결 확인
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Ollama 연결 성공
) else (
    echo ✗ Ollama 연결 실패
    echo   Ollama가 실행 중인지 확인하세요: ollama serve
    echo.
)

echo.
echo [2단계] 의존성 확인
if not exist "node_modules" (
    echo node_modules 폴더가 없습니다. npm install을 실행합니다...
    call npm install
)

echo.
echo [3단계] 개발 서버 시작 (백그라운드)
echo.
echo 종료하려면 터미널에서 Ctrl+C를 누르세요
echo.

start "Next Dev" cmd /c "npm run dev"

echo Waiting for http://localhost:3000 to become available (timeout 60s)...
setlocal enabledelayedexpansion
set max=60
set i=0
:waitloop
powershell -Command "try { $r=(Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop); if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% equ 0 (
    start "" "http://localhost:3000/"
    goto :done
)
ping -n 2 127.0.0.1 >nul
set /a i+=1
if %i% lss %max% goto :waitloop
echo Timed out waiting for dev server. Open http://localhost:3000 manually.
:done

pause

