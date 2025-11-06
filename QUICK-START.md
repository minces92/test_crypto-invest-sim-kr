# 빠른 시작 가이드

## 🚀 실행 방법

### 방법 1: 배치 파일 사용 (Windows)

**개발 서버 시작:**
```
scripts\start-dev.bat
```

더블클릭하거나 명령 프롬프트에서 실행하세요.

**프로덕션 빌드:**
```
scripts\build-production.bat
```

**프로덕션 서버 시작:**
```
scripts\start-production.bat
```

### 방법 2: PowerShell 스크립트 사용

**개발 서버 시작:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1
```

### 방법 3: 직접 npm 명령어 사용

**개발 서버:**
```bash
npm run dev
```

**프로덕션 빌드:**
```bash
npm run build
```

**프로덕션 서버:**
```bash
npm start
```

## 📋 실행 전 확인사항

### 1. Node.js 설치 확인
```bash
node --version
npm --version
```

Node.js 18 이상이 필요합니다.

### 2. 의존성 설치
처음 실행할 때 또는 `package.json`이 변경된 경우:
```bash
npm install
```

### 3. 환경변수 설정 (선택사항)
`.env.local` 파일 생성:
```env
NEXT_PUBLIC_USE_AI_VERIFICATION=true
AI_BACKEND=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL_ANALYSIS=gemma3:4b
```

### 4. Ollama 실행 확인 (AI 기능 사용 시)
```powershell
# Ollama 연결 확인
Invoke-RestMethod -Uri "http://localhost:11434/api/tags"

# Ollama가 실행되지 않았다면
ollama serve
```

## 🌐 접속

개발 서버 시작 후:
- 브라우저에서 http://localhost:3000 접속

## 🔧 문제 해결

### 포트 3000이 이미 사용 중인 경우
```bash
# 다른 포트로 실행
PORT=3001 npm run dev
```

### 모듈을 찾을 수 없는 경우
```bash
# 의존성 재설치
rm -rf node_modules
npm install
```

### Ollama 연결 실패
1. Ollama가 실행 중인지 확인
2. 포트 11434가 열려있는지 확인
3. 방화벽 설정 확인

## 📝 사용 가능한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 (포트 3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 시작 |
| `npm run lint` | 코드 린팅 |

## 🎯 실행 순서 요약

1. **첫 실행:**
   ```bash
   npm install
   npm run dev
   ```

2. **이후 실행:**
   ```bash
   npm run dev
   ```
   또는
   ```
   scripts\start-dev.bat
   ```

3. **프로덕션 배포:**
   ```bash
   npm run build
   npm start
   ```

## 💡 팁

- 개발 중에는 `npm run dev` 사용 (Hot Reload 지원)
- 프로덕션 배포 시에는 `npm run build` 후 `npm start` 사용
- 배치 파일은 Windows에서 더블클릭으로 실행 가능

