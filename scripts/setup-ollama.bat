@echo off
chcp 65001 >nul
echo ========================================
echo Ollama 설치 가이드
echo ========================================
echo.

echo [1단계] Ollama 다운로드
echo.
echo 다음 링크에서 Ollama를 다운로드하세요:
echo https://ollama.com/download
echo.
echo 또는 아래 명령어로 다운로드:
echo.
pause

echo.
echo [2단계] 설치 확인
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    echo Ollama가 이미 설치되어 있습니다.
    ollama --version
) else (
    echo Ollama가 설치되어 있지 않습니다.
    echo 설치 후 다음 명령어를 실행하세요:
    echo   ollama --version
)

echo.
echo [3단계] Ollama 서비스 시작
net start Ollama 2>nul
if %errorlevel% equ 0 (
    echo Ollama 서비스가 시작되었습니다.
) else (
    echo Ollama 서비스를 찾을 수 없습니다.
    echo 수동으로 시작: ollama serve
)

echo.
echo [4단계] 모델 다운로드
echo.
echo 다음 명령어 중 하나를 선택하여 실행하세요:
echo   ollama pull mistral
echo   ollama pull phi
echo   ollama pull llama3
echo.
pause

echo.
echo [5단계] 연결 테스트
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo Ollama 연결 성공!
) else (
    echo Ollama 연결 실패. Ollama가 실행 중인지 확인하세요.
)

echo.
echo ========================================
echo 설치 완료
echo ========================================
pause

