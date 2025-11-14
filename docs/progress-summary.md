# 개발 진행 상황 요약

## 최근 변경 사항 (2025-11-14)

다음 항목들이 프로젝트에 적용되어 문서와 코드에 반영되어 있습니다:

- 텔레그램 알림 신뢰성 개선: 서버측 텔레그램 전송 중앙화, 재시도 로직(임시 오류에 대해 최대 재시도), 디버그 엔드포인트(`/api/test-telegram`).
- 알림 로깅 및 재전송 시스템: `notification_log` 테이블 추가(message_hash, attempt_number, next_retry_at 포함), `logNotificationAttempt` 함수, `resendFailedNotifications` 배치 작업(중복 방지 및 최대 재시도 적용).
- 수동 재전송 기능: `POST /api/notification-logs/retry` 및 UI(`src/components/NotificationLogs.tsx`)에 재전송 버튼 추가.
- 초기 자본 설정: `INITIAL_CASH = 1,000,000` (KRW)로 조정 (`src/context/PortfolioContext.tsx`).
- 글로벌 뉴스 전략 추가: 마켓 `ALL`을 스캔하는 뉴스 기반 전략이 추가되어 전 코인 대상 뉴스 트리거를 지원합니다.
- UI 색상 통일: 손실 색상을 스카이블루(`#87CEEB`)로 정의하는 `.color-fg-loss`와 수익(레드)용 `.color-fg-profit`를 `src/app/globals.css`에 추가했습니다. 실시간 시세 테이블(`src/components/CryptoTable.tsx`)은 이미 새 클래스 사용으로 변경되었습니다.

각 항목의 상세 위치와 검증 방법은 본 문서 아래 섹션을 참고하세요.

## 완료된 작업 ✅

### 1. 차트 고도화
- ✅ EMA, MACD, ATR 계산 함수 추가
- ✅ RSI/MACD 서브 차트 표시
- ✅ 거래 내역 마커 표시
- ✅ 여러 코인 동시 비교 기능 (MultiChartComponent)
- ✅ 거래량 인터랙티브 그래프

### 2. 로컬 캐싱 시스템
- ✅ SQLite 기반 캐싱 시스템
- ✅ 캔들/뉴스 데이터 캐싱
- ✅ API 자동 통합

### 3. AI 통합
- ✅ Ollama 클라이언트 구현
- ✅ AI 분석 API
- ✅ DCA 전략 AI 검증

### 4. 문서 및 설치 가이드
- ✅ Ollama 설치 가이드
- ✅ 구현 요약 문서
- ✅ 설치 스크립트

## 진행 중 / 대기 중

### Ollama 설치 (수동 설치 필요)
- ⚠️ 사용자가 직접 설치 필요
- 📄 `SETUP.md` 파일 참고
- 📄 `docs/ollama-installation-guide.md` 참고

### 향후 개선 사항
- [ ] AI: 더 많은 전략에 AI 검증 추가 (MA, RSI, 볼린저밴드)
- [ ] AI: 변동성 돌파 전략 구현
- [ ] AI: 모멘텀 전략 구현
- [ ] 캐싱: 캐시 관리 대시보드
- [ ] 캐싱: 캐시 통계 및 모니터링

## 다음 단계

1. **Ollama 설치** (사용자 작업)
   - `SETUP.md` 참고하여 Ollama 설치
   - 모델 다운로드 (mistral 또는 phi)
   - `.env.local` 설정

2. **AI 검증 확장** (개발 작업)
   - MA 전략에 AI 검증 추가
   - RSI 전략에 AI 검증 추가
   - 볼린저밴드 전략에 AI 검증 추가

3. **새로운 전략 구현**
   - 변동성 돌파 전략
   - 모멘텀 전략

## Git 커밋 내역

- `7c98163` - 차트 고도화, 로컬 캐싱, AI 통합 기능 구현
- `0987a92` - 여러 코인 비교 차트 및 거래량 그래프 추가

## 참고 문서

- `docs/enhancement-roadmap.md` - 전체 개선 로드맵
- `docs/implementation-summary.md` - 구현 완료 요약
- `docs/ollama-installation-guide.md` - Ollama 설치 가이드
- `SETUP.md` - 빠른 시작 가이드
- `README-OLLAMA.md` - Ollama 사용 가이드

