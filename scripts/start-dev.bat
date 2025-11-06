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
echo [3단계] 개발 서버 시작
echo.
echo 브라우저에서 http://localhost:3000 을 열어주세요
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo.

call npm run dev

pause

