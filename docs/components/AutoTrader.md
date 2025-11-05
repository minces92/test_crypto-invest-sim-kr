# Component: `AutoTrader`

## 1. 개요

자동 매매 전략을 설정하고 관리하는 UI 컴포넌트입니다.

## 2. 기능

-   **전략 선택:** 다음 4가지 투자 전략 중 하나를 선택할 수 있습니다.
    -   적립식 (DCA - Dollar Cost Averaging)
    -   이동평균선(MA) 교차
    -   상대강도지수 (RSI)
    -   볼린저 밴드 (Bollinger Bands)
-   **전략 설정:** 선택된 전략에 필요한 파라미터(예: 매수 금액, 주기, 이평선 기간 등)를 입력합니다.
-   **전략 추가 및 중지:** '전략 추가' 버튼으로 새로운 자동 매매를 시작하고, 실행 중인 전략 목록에서 '중지' 버튼으로 해당 전략을 종료할 수 있습니다.
-   **실행 중인 전략 표시:** 현재 활성화된 모든 자동 매매 전략의 목록과 설정을 보여줍니다.

## 3. 주요 상태(State) 및 Props

### 내부 상태

-   `strategyType`: 현재 선택된 전략 종류 (dca, ma, rsi, bband)
-   `market`: 거래 대상 암호화폐 마켓 코드
-   `dcaAmount`, `dcaInterval`: DCA 전략 파라미터
-   `maShortPeriod`, `maLongPeriod`: 이동평균선 전략 파라미터
-   `rsiPeriod`, `rsiBuyThreshold`, `rsiSellThreshold`: RSI 전략 파라미터
-   `bbandPeriod`, `bbandMultiplier`: 볼린저 밴드 전략 파라미터

### Context 사용

-   `usePortfolio` 컨텍스트 훅을 사용하여 다음 함수와 상태를 가져옵니다.
    -   `strategies`: 현재 실행 중인 모든 전략의 배열
    -   `startStrategy(strategyConfig)`: 새로운 전략을 시작하는 함수
    -   `stopStrategy(strategyId)`: 특정 ID의 전략을 중지하는 함수

## 4. 상호작용

-   사용자가 '전략 추가' 버튼을 클릭하면 `handleAddStrategy` 함수가 호출됩니다.
-   이 함수는 현재 폼에 입력된 값들을 바탕으로 `strategyConfig` 객체를 생성하고, `startStrategy` 컨텍스트 함수를 호출하여 포트폴리오 상태를 업데이트합니다.
-   실행 중인 전략 목록의 '중지' 버튼을 클릭하면 `stopStrategy` 컨텍스트 함수가 해당 전략 ID와 함께 호출됩니다.
