# 뉴스 업데이트 정지(Freeze) 문제 및 수정 사항

요약
- 문제: 뉴스 전략 실행 시 전체 시스템(특히 전략 루프 및 알림 전송)이 느려지거나 멈추는 현상이 관찰됨.
- 원인: 글로벌 뉴스 스캐너가 모든 마켓에 대해 순차적으로(한 번에 하나씩) 외부 뉴스 API를 호출하고, 각 호출이 느리거나 외부 서비스가 응답하지 않으면 전략 실행이 길게 블로킹됨. 또한 알림 전송 시 모든 항목을 즉시 동시에 전송하면 텔레그램 등 외부 서비스에 폭주가 발생할 수 있음.

수정 내용
1. 전략 중복 실행 방지
   - `src/context/PortfolioContext.tsx`에 `strategyRunningRef`를 추가하여 동일 전략이 이미 실행 중이면 해당 tick을 건너뛰도록 했습니다.

2. 병렬성 제한(Bounded Concurrency)
   - 글로벌 뉴스 스캐너가 모든 `KRW-` 마켓을 처리할 때 순차 처리 대신 배치 단위로 병렬 처리하도록 변경했습니다.
   - 기본 병렬도(concurrency)는 5로 설정되어 있으며, 각 배치 후 200ms 지연을 넣어 API 호출 폭주를 완화합니다.

3. 뉴스 API 타임아웃 추가
   - `src/lib/cache.ts`에 `fetchWithTimeout` 헬퍼를 추가하고, NewsAPI 호출에 7초 타임아웃을 적용했습니다. 느린 응답은 예외로 처리되어 호출자에 노출됩니다.

4. 알림 전송 완화
   - `getNewsWithCache`의 notify queue 처리에서 각 텔레그램 전송 전에 200ms 대기하도록 변경하여 전송 폭주를 완화했습니다.

5. 운영 DB 스키마 마이그레이션
   - 개발 환경에서 발견된 `notification_log` 테이블의 누락 컬럼 문제를 고치기 위해 `scripts/migrate-notification-log-columns.js`를 추가했습니다. (로컬 DB에 대해 수동 실행하여 적용함)

검증 방법
- 서버 로그에서 다음 항목을 확인하세요:
  - `[cache] Fetching news:`와 `[cache] News fetch completed in XYZms for query='...'` 로그
  - `[notification] NewsSend` 또는 `[notification] NewsSendError` 로그
- 뉴스 업데이트 버튼 또는 전략이 실행되는 타이밍에 UI/서버가 멈추지 않는지 확인합니다.

권장 추가작업
- 뉴스/텔레그램 호출에 대한 재시도 및 지수 백오프(현재는 단일 시도 + DB에 기록) 추가
- 배치 병렬도 및 타임아웃을 환경변수로 노출
- 알림 전송을 백그라운드 큐(worker)로 완전 이관하여 API와 전략 실행에서 완전히 분리

변경된 파일
- `src/context/PortfolioContext.tsx` (reentrancy, bounded concurrency)
- `src/lib/cache.ts` (fetch timeout, send delay)
- `scripts/migrate-notification-log-columns.js` (DB migration)
- `docs/bugfix-news-freeze.md` (이 문서)

작성자: 자동 수정 스크립트
날짜: 2025-11-25
