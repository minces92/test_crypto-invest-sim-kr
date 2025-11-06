# 개발 서버 시작 스크립트 (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "암호화폐 투자 시뮬레이터 개발 서버 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ollama 연결 확인
Write-Host "[1단계] Ollama 연결 확인" -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✓ Ollama 연결 성공" -ForegroundColor Green
} catch {
    Write-Host "✗ Ollama 연결 실패" -ForegroundColor Yellow
    Write-Host "  Ollama가 실행 중인지 확인하세요: ollama serve" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2단계] 의존성 확인" -ForegroundColor Green
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules 폴더가 없습니다. npm install을 실행합니다..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "[3단계] 개발 서버 시작" -ForegroundColor Green
Write-Host ""
Write-Host "브라우저에서 http://localhost:3000 을 열어주세요" -ForegroundColor Cyan
Write-Host ""
Write-Host "종료하려면 Ctrl+C를 누르세요" -ForegroundColor Gray
Write-Host ""

npm run dev

