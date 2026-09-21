# MUZIK 베타 구현 보고

## MUZIK-BETA-02 진행 (2026-09-21)
- 최신 목표는 실사용 모바일 웹이다. 발표용 신규 작업 없음. 내부 영상 fixture만 사용한다.
- saveTrack 성공 결과를 외부 API 이전에 조회하고, API 실패 시 동시 커밋 여부를 다시 확인하도록 수정했다. auth/membership 및 입력 digest 검사 유지.
- 원본 checkout에서 등록/수정 성공 후 unavailable/invalid-argument/resource-exhausted 재시도, payload 변조, 신규 ID 실패, API/집계/이벤트 중복 없음까지 **31개 에뮬레이터 검사 PASS**(Node24). 이전 27개 기록을 대체하는 확장 검사다.
- origin/dev b10f514 기준 별도 scratch/beta-integration worktree와 codex/mobile-web-beta 브랜치 생성. 원본 checkout의 미커밋 작업 보존. dev 날짜 훅/미션 스냅샷/구독 API/공동 플리 원본 소스 보존. 최신 demo 원격 PR39의 닉네임 표시와 캐시 초기화 수정을 선택 반영. 자세한 manifest는 통합 브랜치 docs/beta-integration.md.
- 통합 브랜치 npm run lint 및 Functions 빌드 PASS. 통합본 에뮬레이터 31개도 PASS. 두 브라우저 375/390px 및 desktop1280 회귀 PASS, 재입장 닉네임 변경 후 기존 곡/플리 표시 추가 확인. 첫 sandbox 실행은 외부 썸네일 로딩 시간 초과, 네트워크 허용 재실행에서 실제 썸네일 포함 PASS.
- draft PR: https://github.com/team-muzikismulife/muzik/pull/40 (dev 대상, ea7cf0e). GitHub mergeable=true 확인, 원본 checkout 그대로. PR 생성 시 Actions 실행 목록은 비어 있었고 check-suite도 생성되지 않아 이 통합 브랜치 push에도 동일 CI를 실행하도록 보완한다. Node22 결과는 후속 갱신한다.
- 기존 Vercel GitHub 연결이 PR Preview 빌드를 자동 시도하여 실패 상태를 기록했다: https://vercel.com/muzikismylife/dist/4CazQttkVMhTDGX6ATQ1Ns7L6eZa . 수동 배포/우회 프로젝트 생성은 하지 않았다. 실패 로그 접근 전 원인을 단정하지 않으며 production-only 설정이 아직 미확인인 근거다.
- 운영 문서 GitHub 정상 인증 안내와 쓰기 중지→서버·인덱스→rules→웹→검증·개방→구버전 순서를 정정했다. 구버전 직접쓰기 클라이언트는 플래그를 따르지 않으므로 점검 rules가 필요함을 명시했다.
- 의존성 설치가 기존 잠금파일의 취약점 경고(앱 45건, functions 13건)를 출력했다. 자동 major/force 변경은 하지 않았으며 출시 전 의존성 검토가 별도로 필요하다.
- 이 단계에서 main merge/서버·rules·Vercel 배포/결제 변경 없음.

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
