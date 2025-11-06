# Ollama 설치 가이드 (Windows)

## 시스템 사양
- CPU: Intel Core i7-8700K
- RAM: 32GB
- GPU: NVIDIA GTX 1080TI (11GB VRAM)
- OS: Windows 10/11

## 1단계: CUDA 설치 (GPU 가속용)

### 1.1 CUDA Toolkit 다운로드
1. NVIDIA 공식 사이트 방문: https://developer.nvidia.com/cuda-downloads
2. Windows → x86_64 → 10/11 → exe (local) 선택
3. 다운로드한 설치 파일 실행
4. 기본 설정으로 설치 진행

### 1.2 cuDNN 설치 (선택사항, 성능 향상)
- NVIDIA cuDNN 다운로드: https://developer.nvidia.com/cudnn
- CUDA 설치 후 cuDNN 설치 권장

## 2단계: Ollama 설치

### 2.1 자동 설치 (권장)
PowerShell에서 다음 명령어 실행:

```powershell
# Ollama 다운로드 및 설치
Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "$env:TEMP\OllamaSetup.exe"
Start-Process -FilePath "$env:TEMP\OllamaSetup.exe" -ArgumentList "/S" -Wait
```

### 2.2 수동 설치
1. Ollama 공식 사이트 방문: https://ollama.com/download
2. Windows 버전 다운로드
3. 설치 파일 실행
4. 설치 완료 후 재시작

### 2.3 설치 확인
PowerShell 또는 CMD에서:

```powershell
ollama --version
```

## 3단계: 모델 다운로드

### 3.1 추천 모델 (사양에 맞는 모델)

**경량 모델 (빠른 추론):**
```powershell
# Mistral 7B (권장)
ollama pull mistral

# Phi-2 (매우 경량, 빠름)
ollama pull phi

# Gemma 2B (가장 빠름)
ollama pull gemma:2b
```

**중간 모델 (균형):**
```powershell
# Llama 3 (8B)
ollama pull llama3

# Mistral 7B (기본)
ollama pull mistral
```

**고성능 모델 (정확도 우선):**
```powershell
# Llama 3 70B (대용량, 느림)
ollama pull llama3:70b

# DeepSeek Coder (코딩 특화)
ollama pull deepseek-coder
```

### 3.2 모델 실행 테스트
```powershell
ollama run mistral "안녕하세요"
```

## 4단계: Ollama 서비스 시작

### 4.1 자동 시작 설정
Ollama는 설치 후 자동으로 Windows 서비스로 등록됩니다.

### 4.2 수동 시작
```powershell
# Ollama 서비스 시작
Start-Service Ollama

# 또는 환경변수 설정 후 수동 실행
$env:OLLAMA_HOST="0.0.0.0:11434"
ollama serve
```

### 4.3 연결 확인
```powershell
# PowerShell에서
Invoke-RestMethod -Uri "http://localhost:11434/api/tags"

# 또는 브라우저에서
# http://localhost:11434/api/tags
```

## 5단계: 프로젝트 설정

### 5.1 환경변수 설정
`.env.local` 파일 생성 또는 수정:

```env
# AI 설정
NEXT_PUBLIC_USE_AI_VERIFICATION=true
AI_BACKEND=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=mistral
AI_MODEL_STRATEGY=mistral
AI_MODEL_ALERT=phi
```

### 5.2 테스트
```powershell
# API 테스트
curl http://localhost:11434/api/generate -d '{
  "model": "mistral",
  "prompt": "테스트",
  "stream": false
}'
```

## 6단계: GPU 사용 확인

### 6.1 GPU 사용 확인
```powershell
# Ollama가 GPU를 사용하는지 확인
ollama ps
```

### 6.2 GPU 메모리 모니터링
- 작업 관리자 → 성능 → GPU 확인
- 또는 NVIDIA-SMI: `nvidia-smi`

## 문제 해결

### Ollama가 시작되지 않는 경우:
1. 방화벽 설정 확인
2. 포트 11434 충돌 확인: `netstat -ano | findstr :11434`
3. Ollama 서비스 재시작: `Restart-Service Ollama`

### GPU가 인식되지 않는 경우:
1. CUDA 설치 확인: `nvcc --version`
2. 드라이버 업데이트: NVIDIA GeForce Experience
3. Ollama 재설치

### 모델 다운로드 실패:
1. 인터넷 연결 확인
2. 디스크 공간 확인 (모델마다 4-40GB 필요)
3. 프록시 설정 확인

## 성능 최적화

### 메모리 최적화:
- 시스템 RAM: 32GB (충분함)
- GPU VRAM: 11GB (Mistral 7B 사용 가능)

### 추천 설정:
- **일반 사용**: Mistral 7B (약 4GB)
- **빠른 응답**: Phi-2 (약 1.6GB)
- **고품질 분석**: Llama 3 8B (약 4.7GB)

## 다음 단계

설치 완료 후:
1. 프로젝트 재시작: `npm run dev`
2. AI 검증 기능 테스트
3. 브라우저 콘솔에서 오류 확인

