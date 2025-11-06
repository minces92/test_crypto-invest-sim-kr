@echo off
chcp 65001 >nul
echo ========================================
echo 프로덕션 서버 시작
echo ========================================
echo.

if not exist ".next" (
    echo .next 폴더가 없습니다. 먼저 빌드를 실행하세요.
    echo scripts/build-production.bat 를 실행하세요.
    pause
    exit /b 1
)

echo 프로덕션 서버 시작 중...
echo.
echo 브라우저에서 http://localhost:3000 을 열어주세요
echo.
echo 종료하려면 Ctrl+C를 누르세요
echo.

call npm start

pause

