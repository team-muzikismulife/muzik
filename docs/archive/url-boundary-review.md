# 웹 URL 경계 검토

2026-09-21, MUZIK-BETA-04. 기준 PR40 8575f63. 운영 배포/계정 인증/DB 조회/요금제 변경 없이 정적 웹 번들과 로컬 demo-muzik 에뮬레이터만 검사했다.

## 실제 호출 경로

- Expo Router build/getLinkingConfig.js → link/linking.js → fork/getStateFromPath.js → fork/getStateFromPath-forks.js의 parseQueryParams. 이 함수는 new URL(...).searchParams를 사용한다.
- Navigation core 기본 getStateFromPath는 query-string.parse를 사용하지만, 현재 앱에서는 Expo의 fork가 연결된다. Expo getPathFromState와 getPathFromState-forks가 쓰는 query-string API는 stringify다.
- query-string의 decode-uri-component0.2.2는 실제 minified 번들에 존재한다. 패키지 존재만으로 공격 입력이 도달한다고 판정하지 않았다.
- scripts/test-url-browser.cjs는 각 페이지 진입 전 CDP Profiler의 precise function coverage를 시작한다. 실제 JS 소스에서 decoder export의 고유 오류 문자열을 포함하는 가장 안쪽 함수 범위의 호출 횟수를 읽는다. URL.searchParams 파싱 함수는 해당 URL 생성식의 고유 문자열로 별도 계측하고 호출이 양수인지 확인한다. 식별자가 사라지거나 중복되면 검사가 실패하므로 라이브러리 변경 후 조용히 잘못된 판정을 유지하지 않는다. 번들을 계측용으로 수정하거나 가짜 decoder로 교체하지 않는다.
- 55개 로컬 Edge 회귀에서 decoder 관측55/호출0. 초기 URL 파서 관측 호출235였으며, URL.searchParams 함수로 식별자를 좁힌 추가 오류복구 검사에서도 decoder0/native parser5를 확인했다. 전체 동일 식별자 검사는 최신 CI에서 재확인한다.

## 재현한 오류와 수정

1. /room/join?code=A&code=B가 배열을 입력란에 전달하여 영문 타입 오류와 잘못된 코드 표시를 만들었다.
2. /room/{id}?date=A&date=B는 문자열을 기대하는 날짜 처리에 배열을 전달하여 공통 오류 화면에 빠졌다.
3. 형식/달력이 틀린 날짜와 인코딩된 슬래시/잘못된 팀 ID는 구독 전에 차단하는 명확한 복구 경계가 없었다.

첫 번째 쿼리값을 사용하도록 firstRouteParam을 추가했다(URLSearchParams.get와 같은 선택 규칙). 경로의 id/dateKey는 기존 Expo path-param 우선 규칙을 유지한다. 팀/날짜 래퍼는 문서 ID 형식과 실제 달력 날짜를 검사하고, 잘못된 값은 구독/메타갱신 전에 InvalidLink로 보낸다. 명시한 과거 날짜를 조용히 오늘로 바꾸지 않는다. 복구 버튼은 팀 목록으로 돌아가며, 잘못된 초대코드는 기존 코드 수정 입력 경로에 보존한다.

## 검사 범위

- 첫 진입 홈, /r/{code}, /room/join, 팀 홈, 날짜별 플레이리스트.
- 정상/인코딩된 코드·ID·날짜, 일반 query, 단독 %, %GG, 잘린 UTF-8, overlong UTF-8, surrogate, %FF, 이중 인코딩, 중복 query, path/query 키 충돌, fragment, 인코딩된 슬래시, 실제로 없는 달력 날짜.
- 긴 입력도 URL 하나당4096자 미만. 최대 혼합 query는 %FF 512개와 단독 % 1024개다. 무제한 fuzz/부하 테스트나 공개 서버 대상 공격은 하지 않았다. 이는 테스트 상한이며 앱 전체 URL 길이 제한을 구현했다는 뜻은 아니다.
- 실제 export한 dist를 임시 loopback 정적 서버에서 제공한다. 모든 페이지 요청은 localhost/127.0.0.1만 허용하고 외부 썸네일·Google 요청은 전송 전에 차단한다. 가입용 팀은 에뮬레이터에만 생성한다.
- 케이스별 브라우저 탐색5초/요소4초, 전체180초 watchdog. 예상 화면, 코드 보존, 지정 날짜의 플리 이동, origin/path 유지, 오류 복구 버튼, 흰 화면/JS 오류 유무를 확인한다.
- 새 오류 화면은390px/1280px 캡처와 가로 넘침 검사로 확인했다. 스크린샷은 로컬 scratch에만 보관한다.

실행: Node22, npm ci 후 npm run build:emulator. 에뮬레이터 실행 중 node scripts/test-url-browser.cjs. Windows Edge는 TEST_BROWSER_CHANNEL=msedge, 기본 CI는 Chromium. TEST_URL_FILTER는 진단용 일부 선택, 정식 CI는 설정하지 않아55개 전체 실행. TEST_SCREENSHOTS=true는 오류 화면 로컬 캡처용이다. Playwright1.62.1을 개발 의존성에 고정하고 [공식 CI 설치 방식](https://playwright.dev/docs/ci)에 따라 Chromium을 설치한다.

## 최종 판정

### A. 완료된 로컬 출시 검증
웹 URL decoder 검토와 재현된 중복 파라미터 오류 수정은 완료했다. 해당 범위에서 추가 자체 구현이 필요한 차단 문제는 발견되지 않았다. 최신 PR CI 결과는 launch-worker-report.md 및 PR 댓글에 기록한다. 코드 리뷰 승인은 별도다.

### B. 외부 조건 대기
실 Firebase/YouTube/App Check 연결·설정과 운영 종단검증, Vercel 정식 프로젝트 설정/실패 로그 접근, 승인된 기존 데이터 사전검사·복구 여부 판단, Safari/카카오 실기기 확인이 남았다. 이들은 로컬 fixture/Chromium 검증으로 대체할 수 없다. **운영 미배포·공개 모집 보류이며, 외부 조건 대기 준비 상태**다. 총괄은 같은 성공 검사를 반복하거나 새 로컬 과제를 자동 생성하지 않고 외부 조건 변화 또는 실제 결함을 근거로 다음 단위를 열면 된다.

### C. 후속 유지보수
남은 dependency-audit의 uuid/빌드 도구 경로 및 호환 SDK/Router 업데이트, Actions 실행기/setup-java 사용 중단 예정과 캐시 경고는 별도 유지보수다. 의존성 경고0/모든 입력에 대한 무위험/실기기 검증 완료를 의미하지 않는다. 새로운 라우터·파서·사용자 파일 처리 기능이 생기면 현재 노출 판단을 다시 검토한다.
