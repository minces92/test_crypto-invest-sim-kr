# Ollama 자동 설치 스크립트 (Windows PowerShell)
# 관리자 권한으로 실행 필요

Write-Host "=== Ollama 설치 스크립트 ===" -ForegroundColor Cyan
Write-Host ""

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "경고: 관리자 권한이 필요합니다." -ForegroundColor Yellow
    Write-Host "PowerShell을 관리자 권한으로 실행해주세요." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "계속하시겠습니까? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

# 1. Ollama 설치 확인
Write-Host "[1/4] Ollama 설치 확인 중..." -ForegroundColor Green
$ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue

if ($ollamaInstalled) {
    Write-Host "Ollama가 이미 설치되어 있습니다." -ForegroundColor Green
    $version = ollama --version
    Write-Host "버전: $version" -ForegroundColor Gray
} else {
    Write-Host "Ollama가 설치되어 있지 않습니다. 다운로드 중..." -ForegroundColor Yellow
    
    # Ollama 다운로드
    $installerPath = "$env:TEMP\OllamaSetup.exe"
    $downloadUrl = "https://ollama.com/download/OllamaSetup.exe"
    
    try {
        Write-Host "다운로드 중: $downloadUrl" -ForegroundColor Gray
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "설치 중..." -ForegroundColor Yellow
        Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
        Write-Host "Ollama 설치 완료!" -ForegroundColor Green
        
        # 환경변수 새로고침
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # 설치 확인
        Start-Sleep -Seconds 3
        $ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue
        if (-not $ollamaInstalled) {
            Write-Host "경고: Ollama가 PATH에 추가되지 않았습니다. 재시작 후 다시 시도해주세요." -ForegroundColor Yellow
            exit
        }
    } catch {
        Write-Host "오류: Ollama 다운로드 실패 - $_" -ForegroundColor Red
        Write-Host "수동으로 다운로드해주세요: https://ollama.com/download" -ForegroundColor Yellow
        exit
    }
}

# 2. Ollama 서비스 확인
Write-Host ""
Write-Host "[2/4] Ollama 서비스 확인 중..." -ForegroundColor Green
try {
    $service = Get-Service Ollama -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -ne "Running") {
            Write-Host "Ollama 서비스 시작 중..." -ForegroundColor Yellow
            Start-Service Ollama
            Start-Sleep -Seconds 2
        }
        Write-Host "Ollama 서비스 실행 중" -ForegroundColor Green
    } else {
        Write-Host "Ollama 서비스를 찾을 수 없습니다. 수동으로 시작해주세요." -ForegroundColor Yellow
    }
} catch {
    Write-Host "서비스 확인 중 오류 발생: $_" -ForegroundColor Yellow
}

# 3. 연결 테스트
Write-Host ""
Write-Host "[3/4] Ollama 연결 테스트 중..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "Ollama 연결 성공!" -ForegroundColor Green
} catch {
    Write-Host "Ollama 연결 실패: $_" -ForegroundColor Red
    Write-Host "Ollama가 실행 중인지 확인해주세요." -ForegroundColor Yellow
    Write-Host "수동으로 시작: ollama serve" -ForegroundColor Gray
}

# 4. 모델 다운로드 (선택)
Write-Host ""
Write-Host "[4/4] 모델 다운로드" -ForegroundColor Green
Write-Host "Download model selection:" -ForegroundColor Cyan
Write-Host "1. Mistral 7B (Recommended, ~4GB)" -ForegroundColor Gray
Write-Host "2. Phi-2 (Lightweight, ~1.6GB)" -ForegroundColor Gray
Write-Host "3. Llama 3 8B (Balanced, ~4.7GB)" -ForegroundColor Gray
Write-Host "4. Skip" -ForegroundColor Gray

$choice = Read-Host "선택 (1-4)"

switch ($choice) {
    "1" {
        Write-Host "Mistral 7B 다운로드 중..." -ForegroundColor Yellow
        ollama pull mistral
    }
    "2" {
        Write-Host "Phi-2 다운로드 중..." -ForegroundColor Yellow
        ollama pull phi
    }
    "3" {
        Write-Host "Llama 3 8B 다운로드 중..." -ForegroundColor Yellow
        ollama pull llama3
    }
    default {
        Write-Host "모델 다운로드를 건너뜁니다." -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== 설치 완료 ===" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "1. .env.local 파일에 다음 설정 추가:" -ForegroundColor Yellow
Write-Host "   NEXT_PUBLIC_USE_AI_VERIFICATION=true" -ForegroundColor Gray
Write-Host "   AI_BACKEND=ollama" -ForegroundColor Gray
Write-Host "   AI_BASE_URL=http://localhost:11434" -ForegroundColor Gray
Write-Host "   AI_MODEL_ANALYSIS=mistral" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 프로젝트 재시작: npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test: ollama run mistral 'Hello'" -ForegroundColor Gray

