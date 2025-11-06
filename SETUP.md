# Ollama 설치 안내 (수동 설치 필요)

## ⚠️ 중요: Ollama는 수동으로 설치해야 합니다

현재 시스템에서 Ollama가 설치되지 않았습니다. 다음 단계를 따라 설치해주세요.

## 설치 방법

### 방법 1: 공식 웹사이트에서 다운로드 (권장)

1. **다운로드**
   - 브라우저에서 https://ollama.com/download 방문
   - Windows 버전 다운로드 클릭
   - `OllamaSetup.exe` 파일 다운로드

2. **설치**
   - 다운로드한 파일 실행
   - 설치 마법사 따라 진행
   - 설치 완료 후 재시작 (선택사항)

3. **확인**
   ```powershell
   ollama --version
   ```

### 방법 2: PowerShell로 다운로드

```powershell
# 관리자 권한 PowerShell에서 실행
Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "$env:TEMP\OllamaSetup.exe"
Start-Process -FilePath "$env:TEMP\OllamaSetup.exe" -ArgumentList "/S" -Wait
```

## 모델 다운로드

설치 완료 후 다음 명령어로 모델을 다운로드하세요:

```powershell
# Mistral 7B (권장, 약 4GB, 32GB RAM에서 실행 가능)
ollama pull mistral

# 또는 Phi-2 (경량, 약 1.6GB, 빠른 응답)
ollama pull phi
```

## 연결 확인

설치 및 모델 다운로드 후:

```powershell
# PowerShell에서
Invoke-RestMethod -Uri "http://localhost:11434/api/tags"

# 또는 브라우저에서
# http://localhost:11434/api/tags
```

## 프로젝트 설정

`.env.local` 파일 생성 또는 수정:

```env
NEXT_PUBLIC_USE_AI_VERIFICATION=true
AI_BACKEND=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=mistral
```

## 다음 단계

1. Ollama 설치 완료
2. 모델 다운로드 완료
3. `.env.local` 설정 완료
4. 프로젝트 재시작: `npm run dev`

설치 중 문제가 발생하면 `docs/ollama-installation-guide.md`를 참고하세요.

