@echo off
chcp 65001 >nul
echo ========================================
echo 프로덕션 빌드
echo ========================================
echo.

echo [1단계] 의존성 설치
if not exist "node_modules" (
    call npm install
)

echo.
echo [2단계] 프로덕션 빌드
call npm run build

echo.
echo [3단계] 빌드 완료
echo.
echo 다음 명령어로 프로덕션 서버를 시작할 수 있습니다:
echo   npm start
echo.
echo 또는 scripts/start-production.bat 를 실행하세요
echo.

pause

