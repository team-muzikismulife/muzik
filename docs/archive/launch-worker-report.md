# MUZIK 베타 구현 보고

## MUZIK-BETA-04 최종 로컬 검토 (2026-09-21)

### A. 완료된 로컬 출시 검증
- 기준 PR40 8575f63의 실제 CI35567087260/Node22/서버31·legacy6 PASS 확인 후 웹 URL decoder 노출 검토만 수행했다. 원본 사용자 checkout 소스는 수정하지 않았다.
- 실제 minified 정적 번들55개 링크 회귀 PASS. 홈/초대/팀/날짜, 깨진 percent·UTF-8·이중 인코딩·중복 query·경로 키 충돌·긴 입력/오류 복구를 검사했다. 각 URL4096자 미만, loopback 서버/에뮬레이터만 사용하고 외부 요청은 차단했다.
- decoder 함수는 번들 내 존재하지만55회 관측 중 호출0이었다. Expo의 URL 파싱이 실행되는 것을 별도 계측했고 URL.searchParams 함수에 대한 고유 식별자도 검증했다. 정적 존재만으로 노출을 단정하지 않았으며 취약점 경고는 삭제하지 않았다.
- 실제로 재현한 중복 code 배열 입력/중복 date 오류 화면을 수정했다. 첫 쿼리값을 선택하고 팀 ID·실제 달력 날짜 검증을 구독 전 적용했다. 잘못된 링크는 명시적인 복구 화면, 정상 과거 날짜는 그대로 유지한다.
- 타입/웹 export PASS. 기존 정적 번들 두 브라우저 가입/초대/등록/실패 재시도/재방문/닉네임/개인숨김/신고/날짜 플리 회귀 PASS. 오류 화면390/1280px 시각 확인 및 가로 넘침 없음. Playwright1.62.1 개발 의존성과55개 URL 정적 번들 회귀를 CI에 추가했다. npm 설치 후 audit28건으로 경고 수 변화 없음. 최신 변경 HEAD의 원격 CI는 push 후 별도 확인한다.
- 구현/검증 근거와 제한은 docs/url-boundary-review.md. 이 범위에서 **추가 자체 구현이 필요한 로컬 출시 차단 항목은 발견되지 않았다.** 코드 리뷰 승인은 별도다.

### B. 실제 사용자·계정 조작이 필요한 외부 조건
- 실 Firebase/YouTube/App Check 설정·종단검증, Vercel 정식 프로젝트 설정/실패 로그 접근, 승인된 기존 데이터 점검·복구 판단, Safari/카카오 실기기 확인이 남았다.
- 이번 단위에서 운영 데이터 조회/마이그레이션, Firebase/Vercel 인증 재시도, 요금제·키 변경, main merge, 수동 배포 또는 공개 홍보 없음. **운영 미배포, 외부 조건 대기 준비 상태**다. 외부 조건 변화나 새로운 실제 결함 없이 로컬 성공 검사를 반복하거나 새 작업을 자동 생성할 필요가 없다.

### C. 출시 후 유지보수
- dependency-audit의 잔여 uuid/빌드 도구 경로 판단을 유지한다. 호환 SDK/Router 업데이트, Actions 실행기/setup-java 및 캐시 경고는 후속 유지보수로 넘겼다. 현재 성공 검사 정확성을 바꾸는 증거는 없다.
- 무위험/취약점0/실기기 검증 완료를 의미하지 않는다. 파서/라우터/사용자 파일 처리 등 노출 조건이 바뀌면 해당 경계 검사를 다시 수행한다.

## MUZIK-BETA-03 검증 보고 (2026-09-21)
- 실사용 모바일 웹 기준으로 의존성 감사와 기존 Spark 데이터 호환성 검증을 진행했다. 작업 위치는 scratch/beta-integration, codex/mobile-web-beta, dev 대상 draft PR40이다. 원본 사용자 checkout 소스는 변경하지 않았다.
- npm audit 전체: 앱/도구 **45(high15/moderate30)→28(high6/moderate22)**, Functions **13(high1/moderate12)→9(high0/moderate9)**. omit=dev는 각각22/9. audit 숫자는 상위 의존성 전파도 포함하며 실제 취약 경로 개수가 아니다. qs/Express/XML parser/PostCSS 및 도구의 호환 패치를 적용했다. force/Expo·RN·Admin major 업데이트는 하지 않았다.
- Navigation core7.22.1 갱신은 Expo Router5의 미선언 query-string 참조로 실제 웹 export가 실패하여 채택하지 않았다. 호환 버전7.21.5로 고정하고 export/정적 번들 브라우저 회귀를 다시 통과했다. 잔여 decode-uri-component는 웹 의존성이나 현재 Expo query 파싱은 URL.searchParams를 사용한다. 취약 함수까지 외부 입력이 도달한다고 단정하지 않았으며 전체 링크 경로 회귀/리뷰가 남았다.
- 서버 잔여 uuid 경고는 v3/v5/v6 외부 버퍼 API에 관한 것이며 설치된 SDK 사용처는 v4()였다. Metro image-size는 자산 빌드 경로, CLI import/parser는 개발 도구 경로로 구분했다. 면제/무위험 판정이 아닌 후속 검토 조건을 docs/dependency-audit.md에 명시했다.
- 읽기 전용 scripts/legacy-preflight.mjs 추가: 명시한 방1개, 컬렉션별1000개 제한 및 초과 blocker, 프로젝트/loopback 가드, 기본 운영 접근 거부, 원문 미출력. memberCount/UID·닉네임/곡 날짜·순서·메타/days·theme/숨김 원문을 검사한다. 실제 운영 DB 조회·이관·쓰기 없음.
- 기존 Spark 형태 fixture에 대한 **legacy 6개 PASS**, 기존 서버 권한/동시성/멱등 **31개 PASS**, 모두 Node22.23.2 에뮬레이터. 기존 과거 날짜/주제/순서 보존, 재가입 닉네임, 신고와 archive 접근 차단까지 확인했다. 숨김 tombstone을 allowlist로 바꿔 예전 알 수 없는 필드가 공개 문서에 남지 않도록 수정했으며 archive 원문은 보존했다.
- 타입/Functions 빌드, 웹 export PASS. 실제 export한 정적 dist로 두 브라우저 가입/초대/저장 실패 후 재시도/실시간 표시/재방문/개인숨김/닉네임/신고/날짜 플리 회귀 PASS. 375/390/1280px, 실제 외부 썸네일 로딩, 페이지 JS 오류0. 영상 API는 내부 fixture이며 실 YouTube/App Check 성공 근거가 아니다.
- CI에 웹 export와 legacy 6개 검사를 추가했다. 직전 d9f7098의 실제 Node22 CI PASS는 https://github.com/team-muzikismulife/muzik/actions/runs/35564751805 이며, 이번 변경의 최신 HEAD CI는 push 후 별도로 확인한다.
- Vercel 기존 실패 deployment의 inspect --logs는 자격증명이 없어 인증 안내로 전환되어 즉시 취소했다. 로그인 재시도/키 입력/임시 프로젝트/수동 배포 없음. 원격 실패 원인은 로그로 미확인이고 로컬 export 회귀와 같은 원인으로 단정하지 않는다.
- **공개 모집/운영 배포는 아직 보류**: 남은 의존성 경로 검토, 승인된 기존 데이터 사전검사·복구, 실제 Firebase/YouTube/App Check 종단검증, Vercel 설정/로그, Safari·카카오 실기기 검증 필요. main merge/결제 변경/외부 배포 없음.

## MUZIK-BETA-02 완료 보고 (2026-09-21)
- 최신 목표는 실사용 모바일 웹이다. 발표용 신규 작업 없음. 내부 영상 fixture만 사용한다.
- saveTrack 성공 결과를 외부 API 이전에 조회하고, API 실패 시 동시 커밋 여부를 다시 확인하도록 수정했다. auth/membership 및 입력 digest 검사 유지.
- 원본 checkout에서 등록/수정 성공 후 unavailable/invalid-argument/resource-exhausted 재시도, payload 변조, 신규 ID 실패, API/집계/이벤트 중복 없음까지 **31개 에뮬레이터 검사 PASS**(Node24). 이전 27개 기록을 대체하는 확장 검사다.
- origin/dev b10f514 기준 별도 scratch/beta-integration worktree와 codex/mobile-web-beta 브랜치 생성. 원본 checkout의 미커밋 작업 보존. dev 날짜 훅/미션 스냅샷/구독 API/공동 플리 원본 소스 보존. 최신 demo 원격 PR39의 닉네임 표시와 캐시 초기화 수정을 선택 반영. 자세한 manifest는 통합 브랜치 docs/beta-integration.md.
- 통합 브랜치 npm run lint 및 Functions 빌드 PASS. 통합본 에뮬레이터 31개도 PASS. 두 브라우저 375/390px 및 desktop1280 회귀 PASS, 재입장 닉네임 변경 후 기존 곡/플리 표시 추가 확인. 첫 sandbox 실행은 외부 썸네일 로딩 시간 초과, 네트워크 허용 재실행에서 실제 썸네일 포함 PASS.
- draft PR: https://github.com/team-muzikismulife/muzik/pull/40 (dev 대상). 구현 커밋 ea7cf0e, 검증 기록 1bdd5ef. GitHub mergeable=true 확인, 원본 checkout 그대로. attach_artifact로 현재 작업에 연결했다.
- **실제 GitHub Node22 CI PASS**: https://github.com/team-muzikismulife/muzik/actions/runs/35564165553 (ea7cf0e), https://github.com/team-muzikismulife/muzik/actions/runs/35564239726 (1bdd5ef). 로그에서 node v22.23.2, Functions host node@22, 타입/서버 빌드 및 31개 검사 완료를 확인했다. 실제 외부 YouTube 성공과는 별개다.
- PR 템플릿 검사 PASS: https://github.com/team-muzikismulife/muzik/actions/runs/35564165463 . 최초 Actions 실행 목록이 비어 있어 push 트리거를 임시 추가했으나, 이후 원래 PR 이벤트 실행도 생성·통과한 것을 확인했다. 불필요한 브랜치 전용 트리거는 최종 문서 커밋에서 제거했다. Actions 권한 설정 조회는403이었지만 CI 실행/결과 조회와 PR 작성에는 문제가 없었다.
- 기존 Vercel GitHub 연결이 PR Preview 빌드를 자동 시도하여 실패 상태를 기록했다: https://vercel.com/muzikismylife/dist/4CazQttkVMhTDGX6ATQ1Ns7L6eZa . 수동 배포/우회 프로젝트 생성은 하지 않았다. 실패 로그 접근 전 원인을 단정하지 않으며 production-only 설정이 아직 미확인인 근거다.
- 운영 문서 GitHub 정상 인증 안내와 쓰기 중지→서버·인덱스→rules→웹→검증·개방→구버전 순서를 정정했다. 구버전 직접쓰기 클라이언트는 플래그를 따르지 않으므로 점검 rules가 필요함을 명시했다.
- 의존성 설치가 기존 잠금파일의 취약점 경고(앱 45건, functions 13건)를 출력했다. 자동 major/force 변경은 하지 않았으며 출시 전 의존성 검토가 별도로 필요하다.
- 이 단계에서 main merge/서버·rules·Vercel 배포/결제 변경 없음.

### 총괄 후속 확인
- 이번 단위의 재시도 수정·31개 회귀·dev 통합 draft PR·Node22 실제 CI·운영 문서 정정은 완료했다. main 병합은 리뷰 후 별도다.
- CodeRabbit 상태는 success로 보이지만 댓글상 draft 자동 리뷰 생략이다. 코드 리뷰 완료로 계산하지 않는다.
- 기존 Vercel 자동 Preview 실패는 Node22 CI와 별도 출시 차단 항목이다. 정식 프로젝트/production-only 설정/빌드 로그는 로그인 후 확인해야 한다.
- 실제 Firebase/YouTube/App Check 종단검증, Safari/카카오 실기기, 의존성 취약점 검토, 운영 설정과 결제 승인, 구버전 데이터 이관은 남았다. 로컬 검증만으로 홍보를 열지 않는다.
- 최신 통합 소스는 scratch/beta-integration에 있다. 원래 checkout에는 사용자 작업 보존을 위해 통합 소스를 역복사하지 않았고, 총괄 조회용 보고서/운영 문서만 동기화했다. 테스트 이미지는 로컬에만 남겼다.

## 이전 MUZIK-BETA-01 기록
아래는 직전 실행 당시의 기록이며, 27개 검사/PR 미생성/Node22 미검증 상태는 위 BETA-02 결과로 대체된다.

2026-09-21 로컬 베타 구현 및 검증 완료. **운영 배포 미완료**, 공개 모집 보류.

## 진단
- 작업 시작 HEAD demo/spark-web c13b952, origin/main 0ba1505. main 대비 앱/Functions 등 81개 파일, 약 27,929줄 추가. 미커밋 25개 수정 및 기존 미추적 UI/설계 파일 보존. branch 이동/reset/stash/전체 add 없음.
- P0: 기존 운영 기본 빌드 --mock-preview, __DEV__ 자동 목업 UID, Spark 클라 직접쓰기 및 멤버 자기생성 허용 규칙. 모드 명시화 및 callable/읽기 전용 규칙으로 로컬 수정.
- P0: 실서비스 서버/웹 종단 검증 미완료. 기존 dist 발표 alias는 실서버 성공 근거가 아님.
- Firebase 기존 프로젝트 muzik-42b60 목록 조회 성공(샌드박스 밖 읽기 권한 필요). 결제 API 결과 billingEnabled=false, Anonymous Auth=true. Functions 목록 조회는 Cloud Functions API SERVICE_DISABLED(403). Secret Manager 조회도403이므로 YouTube 비밀값 존재 여부는 미확인.
- Vercel whoami: login_required. 새 프로젝트 생성/우회 배포 없음.
- GitHub 인증: 샌드박스 안에서는 invalid로 보였으나, 네트워크 권한을 갖춘 재검사는 정상(swaan-kim). 열린 PR 목록은0개. 현재 .vercel 연결 projectName=dist, Vercel 재로그인이 필요하므로 production branch main 여부 미확인.
- main..HEAD는 양쪽 고유 커밋2/47개. main쪽 변경은 README.md, 읽기전용 merge-tree는 README 충돌 표시. dev..HEAD도14/15개로 분기되어 있다. **통째로 merge하면 안전하다고 보고할 수 없음.** 현재 미커밋 작업의 dev 기준 통합은 아직 실행하지 않았다.

## 완료된 로컬 변경
- production/demo/emulator 분리, production Firebase 필수 설정 및 App Check 사이트 키 검사, export 실패 코드 전파, 빌드 스크립트 자동 dist 프로젝트 배포 제거.
- callable 생성/참여/곡CRUD/미리보기/메타갱신/신고/피드백/방문/운영검토 추가. 서버 검증, 요청 멱등, 정원/날짜 집계, 기본 rate limit, App Check(운영), 인스턴스 제한.
- Firestore 클라 쓰기 전부 차단. 운영 숨김 원문은 비공개 archive에 보관, 곡 슬롯 유지, 공개집계 제외.
- 익명 브라우저 한계 안내, 실제 곡 카드 예시, 후속 공동즐겨찾기 UI/URL 차단, 개인숨김/신고/피드백/운영검토 UI. 날짜별 목록 위치 고정 유지, 서버 저장 성공과 캐시/서버 구독 상태 분리. 잘못된 초대코드 보존, 실패 입력 보존, 서버 응답 날짜로 이동, 자정 갱신.
- 개별 곡 유튜브 이동 버튼, 실패 안내, 과거 days.themeText 사용. production 초대링크는 현재 웹 origin 우선으로 옛 발표 alias 혼용 방지.
- convention/PR 템플릿에 main production, dev 통합, hotfix, 릴리즈 검증 규칙 명시. 기존 demo 브랜치 삭제/원격 설정 변경은 하지 않았다.
- CI에 Functions 빌드와 Java21 기반 emulator 회귀 추가. 로컬 실행 증거와 CI 설정은 구별하며 GitHub CI 실행 자체는 아직 없음.

## 실행 증거
- npm run lint: 최종 UI까지 PASS. npm --prefix functions run build: PASS. git diff --check: PASS(CRLF 경고만).
- node scripts/test-beta.mjs: **27개 PASS**. Auth/Firestore/Functions 에뮬레이터 실제 요청: 비로그인/비멤버, 직접쓰기, KST 자정, 30자 제한, 날짜/UID 위조, 같은/다른 요청ID 동시등록, 집계/커버, 정원경합, 운영권한, 숨김/원문 접근, 30일 메타갱신, 피드백/방문/익일 이벤트, 쓰기중지 검사.
- YouTube는 MUZIK_TEST_VIDEO_FIXTURE=true + FUNCTIONS_EMULATOR=true 두 조건의 테스트 fixture. 실제 videos.list 성공 증거 아님.
- Node 24 환경에서 Functions node22 대상 빌드 및 에뮬레이터 실행. 운영 node22 런타임 별도 확인 필요.
- npm run build:demo: PASS. 정적 dist 번들 생성, 폰트 vendored 이동, SPA 경로 수정 완료. node scripts/test-demo.cjs: 목업팀/과거5일/곡수에 무관한 추천 위치/실 Firebase 요청0/브라우저 오류0 PASS.
- npm run check:production: **예상대로 FAIL**, EXPO_PUBLIC_RECAPTCHA_SITE_KEY 미설정. 나머지 Firebase 필수변수는 존재(실 값 출력 안 함). 이를 우회하거나 가짜 키로 운영 성공을 만들지 않았다.
- node scripts/test-browser.cjs: Edge headless 독립2컨텍스트, 375/390px 및 desktop1280px. 생성→코드복사→초대→참여→영상 fixture 미리보기→503 저장실패 입력보존→재시도→상대 실시간 표시→새로고침 UID/팀 복원→후속 URL차단→개인숨김 격리→신고/피드백 접수→날짜 플리/개별 재생 진입 PASS. 페이지 JS 오류0. 실제 유튜브 썸네일 로딩 확인.
- 화면 증거: beta-home-mobile.png, beta-room-mobile.png, beta-playlist-mobile.png, beta-playlist-desktop.png, beta-demo-mobile.png. 모두 테스트/시연 데이터이며 실제 이용자 기록이 아님.

## 실제 배포와 미배포
- 실행한 외부 작업은 기존 프로젝트/결제/인증 상태 읽기뿐이다. 공개 서버/웹 배포, rules 배포, 새 프로젝트 생성, 결제 변경, 홍보 게시 없음.
- 공개 운영 URL 없음. 과거 dist 발표 alias를 운영 URL로 재사용하지 않았다.
- `.env`/`.env.local`/자격 증명 파일의 값은 변경하거나 출력하지 않았다. 테스트 모드는 명령 프로세스 환경변수로 지정했다.

## 남은 검증
실 Firebase callable/App Check/YouTube Data API 검증, Node22 실행, 모바일 Safari/카카오 인앱·YouTube 실제 연속재생, 실제 main/Vercel 연동, 기존 운영 데이터의 membershipCount/정책 이관 검토. 서버 API fixture와 브라우저 검사는 이러한 실환경 성공을 대신하지 않는다.

## 남은 사용자 행동 및 다음 실행 단위
1. 기존 Firebase 프로젝트의 Blaze/결제 연결 승인 결정. 현재 billingEnabled=false라 Functions 배포가 불가하다. 자동 전환 금지 조건을 지켰다. 구체적인 비용 통제/점검/중지/복구 제안은 beta-operations.md.
2. Vercel 로그인 갱신 후 올바른 팀 프로젝트를 지정/확인. 임시 dist로 우회 금지. GitHub 인증은 정상이라 재로그인 필요 없음.
3. App Check 웹 도메인 및 사이트 키, 서버 YouTube 비밀값 설정. 운영자 지정 UID/claim 확인.
4. 다음 단위: dev와 현재 변경을 기능별로 통합 검토해 feature PR 작성→에뮬레이터 CI→서버/규칙/정식웹 순차배포→운영 URL 두 사용자 검증→실기기 확인. 안전한 배포·롤백 절차는 beta-operations.md에 작성했다.

총괄 참고: 이벤트 visit은 UID당 KST 일1회다(세션 수 아님). beta-promotion.md의 측정 정의를 이에 맞추거나 후속 지시로 세션 계약을 확정해야 한다. 총괄 소유 문서는 수정하지 않았다.
