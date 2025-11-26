# Crypto Invest Sim Documentation

Welcome to the official documentation for the `crypto-invest-sim-kr` project. This directory contains all the necessary information regarding the project's features, architecture, configuration, and development roadmap.

---

## 📋 BDD 스팩 및 검토 (Spec-Driven Documentation)

### 🎯 현재 상태 검토
- **[FINAL-REVIEW-SUMMARY.md](./FINAL-REVIEW-SUMMARY.md)** - 종합 평가 및 경영진 요약
  - 프로젝트 전체 평가 (100% 기능 완성)
  - Critical 버그 3개 식별
  - 개선 권장사항 10개
  - 신규 기능 제안 8개
  - 프로덕션 배포 준비도 평가

### 📚 BDD 스펙서 (Behavior-Driven Development)
- **[SPECIFICATIONS.md](./SPECIFICATIONS.md)** - 완전한 기능 명세
  - 8가지 핵심 기능 (Feature 1-8)
  - 각 기능별 Gherkin 형식 시나리오
  - Acceptance Criteria (수용 기준)
  - 현재 구현 상태표

### 🚀 개선 로드맵
- **[IMPROVEMENT-ROADMAP.md](./IMPROVEMENT-ROADMAP.md)** - 우선순위별 개선사항
  - 🔴 Critical (Sprint 0): 3개 즉시 수정 필요 버그
  - 🟠 High Priority (Sprint 1-2): 3개 고우선순위 개선
  - 🟡 Low Priority (Sprint 3+): 7개 개선사항
  - 구현 기간 추정 및 검증 방법

### ✨ 신규 기능 제안
- **[NEW-FEATURES-DETAILED.md](./NEW-FEATURES-DETAILED.md)** - 상세 기능 설계
  - **Feature #1**: 포트폴리오 성과 분석 대시보드 (1순위)
  - **Feature #2**: 커스텀 거래 전략 빌더 (2순위)
  - **Feature #3**: 거래 일지 시스템 (3순위)
  - **Feature #4**: 포트폴리오 공유 & 벤치마킹 (4순위)
  - 각 기능의 데이터 모델, API, 컴포넌트 설계 포함

---

## 🎯 핵심 기능 (Core Features)

이 프로젝트는 다음 8가지 핵심 기능을 제공합니다:

| # | 기능 | 상태 | 평가 | 상세 |
|---|------|------|------|------|
| 1 | 실시간 시세 조회 | ✅ 완료 | ⭐⭐⭐⭐ | Upbit API, 5초 갱신 |
| 2 | 가상 거래 | ✅ 완료 | ⭐⭐⭐⭐ | 매수/매도, ACID 보호 |
| 3 | 포트폴리오 관리 | ✅ 완료 | ⭐⭐⭐⭐ | 평가금액, 수익률 |
| 4 | 차트 & 분석 | ✅ 완료 | ⭐⭐⭐⭐⭐ | EMA, MACD, RSI, ATR |
| 5 | 자동 거래 | ✅ 완료 | ⭐⭐⭐⭐ | 4가지 전략, 백테스트 |
| 6 | 뉴스 피드 | ✅ 완료* | ⭐⭐⭐ | NewsAPI, 감정분석, Telegram |
| 7 | 설정 & 알림 | ✅ 완료 | ⭐⭐⭐ | 알림 이력, 갱신 주기 조정 |
| 8 | Ollama AI | ✅ 완료 | ⭐⭐⭐⭐ | 로컬 LLM 분석 |

*Feature 6: 부분 이슈 있음 (다중 키워드 검색, 설정 동기화)

---

## 🔧 구성 및 가이드 (Configuration & Guides)

### 설정 및 튜토리얼
- **[Performance Tuning](./performance-tuning.md)**: 데이터 갱신 주기 조정
- **[Telegram Notifications](./notifications.md)**: 알림 설정 가이드
- **[Ollama AI Setup](./ollama-installation-guide.md)**: Ollama 설치 및 구성

### 문제 해결
- **[Troubleshooting](./troubleshooting.md)**: 일반적인 문제 해결
- **[Notification Troubleshooting](./notification-troubleshooting.md)**: 알림 관련 이슈

---

## 📖 API 레퍼런스 (API Reference)

### 데이터 조회 API
- **[Tickers](./api/tickers.md)**: 실시간 가격 데이터
- **[Candles](./api/candles.md)**: 차트 데이터 (OHLCV)
- **[Strategies](./api/strategies.md)**: 거래 전략

### 트랜잭션 관리
- **[Transactions](./api/transactions.md)**: 거래 이력 관리
- **[Analyze Trade](./api/analyze-trade.md)**: AI 거래 분석

---

## 🧩 컴포넌트 라이브러리 (Component Library)

### 주요 컴포넌트
- **[ChartComponent](./components/ChartComponent.md)**: 단일 암호화폐 차트
- **[MultiChartComponent](./components/ChartComponent.md)**: 다중 비교 차트
- **[AutoTrader](./components/AutoTrader.md)**: 자동 거래 관리
- **[Portfolio](./components/Portfolio.md)**: 포트폴리오 대시보드
- **[CryptoTable](./components/CryptoTable.md)**: 실시간 시세표
- **[TransactionHistory](./components/TransactionHistory.md)**: 거래 이력
- **[NotificationLogs](./components/NotificationJobs.md)**: 알림 및 설정 패널

---

## 🚀 배포 및 운영 (Deployment & Operations)

### 배포 전 체크리스트
[FINAL-REVIEW-SUMMARY.md](./FINAL-REVIEW-SUMMARY.md#-배포-전-체크리스트) 참고

### 개발 단계별 가이드
1. **버그 수정** (Sprint 0, 2-3일)
2. **성능 최적화** (Sprint 1-2, 5-7일)
3. **UX 개선** (Sprint 2, 7-10일)
4. **신규 기능** (Sprint 3+, 8-10주)

---

## 📊 프로젝트 통계

```
전체 기능:         100% (8/8 완성)
코드 품질:         75% (보안, 테스트 개선 필요)
사용자 경험:       80% (UI 개선 사항 있음)
프로덕션 준비도:   55% (Critical 버그 수정 필요)

임계 버그:         3개
개선 권장:         10개
신규 기능:         8개
```

---

## 🎓 시작하기 (Getting Started)

1. **현재 상태 파악**: [FINAL-REVIEW-SUMMARY.md](./FINAL-REVIEW-SUMMARY.md) 읽기
2. **기능 이해**: [SPECIFICATIONS.md](./SPECIFICATIONS.md)의 BDD 시나리오 참고
3. **개선 계획**: [IMPROVEMENT-ROADMAP.md](./IMPROVEMENT-ROADMAP.md)의 우선순위 확인
4. **새 기능 검토**: [NEW-FEATURES-DETAILED.md](./NEW-FEATURES-DETAILED.md)의 제안사항 검토

---

## 📞 연락처 및 기여 (Contact & Contributing)

프로젝트에 대한 질문이나 개선 제안:
- GitHub Issues: 버그 리포트 및 기능 요청
- GitHub Discussions: 일반적인 토론

---

## 📝 문서 히스토리

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0.0 | 2025-11-26 | BDD 스펙, 개선 로드맵, 신규 기능 제안 추가 |
| (이전) | - | 기본 가이드 및 튜토리얼 |

---

**마지막 업데이트:** 2025-11-26