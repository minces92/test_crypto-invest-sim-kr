# Ollama 설치 및 설정 가이드

## 빠른 시작

### 1. Ollama 다운로드 및 설치

**Windows:**
1. https://ollama.com/download 방문
2. Windows 버전 다운로드
3. 설치 파일 실행
4. 설치 완료

**또는 자동 설치:**
```powershell
# PowerShell (관리자 권한)
Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "$env:TEMP\OllamaSetup.exe"
Start-Process -FilePath "$env:TEMP\OllamaSetup.exe" -ArgumentList "/S" -Wait
```

### 2. 설치 확인
```powershell
ollama --version
```

### 3. 모델 다운로드 (권장)
```powershell
# Mistral 7B (권장, 약 4GB)
ollama pull mistral

# 또는 Phi-2 (경량, 약 1.6GB)
ollama pull phi
```

### 4. 연결 테스트
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:11434/api/tags"

# 또는 브라우저
# http://localhost:11434/api/tags
```

### 5. 프로젝트 설정

`.env.local` 파일 생성:
```env
NEXT_PUBLIC_USE_AI_VERIFICATION=true
AI_BACKEND=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=mistral
```

### 6. 프로젝트 재시작
```bash
npm run dev
```

## 수동 설치 단계

### Windows에서:
1. https://ollama.com/download 에서 Windows 버전 다운로드
2. 설치 파일 실행
3. 설치 완료 후 PowerShell 재시작
4. `ollama --version` 명령어로 확인
5. `ollama pull mistral` 로 모델 다운로드
6. `ollama serve` (필요시) 또는 Windows 서비스로 자동 실행됨

## 문제 해결

### Ollama가 실행되지 않는 경우:
```powershell
# Ollama 서비스 시작
Start-Service Ollama

# 또는 수동 실행
ollama serve
```

### 포트 충돌:
```powershell
# 포트 확인
netstat -ano | findstr :11434

# 다른 포트 사용 (환경변수)
$env:OLLAMA_HOST="0.0.0.0:11435"
ollama serve
```

### GPU 사용 확인:
```powershell
# GPU 사용 여부 확인
ollama ps
```

## 자세한 가이드

`docs/ollama-installation-guide.md` 파일을 참고하세요.

