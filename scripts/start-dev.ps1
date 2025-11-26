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
Write-Host "[3단계] 개발 서버 시작 (백그라운드)" -ForegroundColor Green
Write-Host ""

# Start dev server in a new process so we can poll the server and trigger server-side workers
Write-Host "Starting 'npm run dev' in background..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "npm" -ArgumentList "run","dev" -NoNewWindow -PassThru

Write-Host "Waiting for http://localhost:3000 to become available (timeout 60s)..." -ForegroundColor Yellow
$maxAttempts = 60
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
            Write-Host "Server is up (HTTP $($resp.StatusCode)). Triggering root request to initialize server-side workers..." -ForegroundColor Green
            # Trigger a simple GET to root to ensure server-side layout imports (server-init) run
            Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
            Start-Process "http://localhost:3000/"
            break
        }
    } catch {
        # ignore and retry
    }
    Start-Sleep -Seconds 1
    $attempt++
}

if ($attempt -ge $maxAttempts) {
    Write-Host "Timed out waiting for dev server to start. Check the dev server output window." -ForegroundColor Red
    Write-Host "If the site doesn't open automatically, open http://localhost:3000 in your browser after the dev server finishes building." -ForegroundColor Yellow
}

