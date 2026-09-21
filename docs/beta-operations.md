# 모바일 웹 베타 운영·배포·복구

## 2026-09-21 실제 상태
- 기존 Firebase muzik-42b60 읽기 접근 가능. Anonymous Auth 활성화.
- billingEnabled=false. Cloud Functions API SERVICE_DISABLED(403). Secret Manager 조회도 403이므로 YouTube 키 등록 유무 확인 불가.
- Vercel 저장된 로그인은 갱신 필요(login_required). 로컬 연결은 dist이며 정식 프로젝트/production branch 확인 전 재배포 금지.
- 운영 App Check 사이트 키 미설정. 실제 운영 서버 및 웹 배포를 실행하지 않았다. 과거 발표 alias는 운영 증거가 아니다.

## 로컬 재현
Node 22, Java 21 이상, npm ci 및 npm --prefix functions ci.

1. 환경변수 EXPO_PUBLIC_APP_MODE=emulator를 설정하고 이전 EXPO_PUBLIC_USE_EMULATOR/EXPO_PUBLIC_ENABLE_MOCK_PREVIEW 활성값을 제거한다.
2. Functions 빌드: npm --prefix functions run build.
3. 테스트 영상 fixture가 필요할 때만 MUZIK_TEST_VIDEO_FIXTURE=true를 에뮬레이터 프로세스에 설정한다. 운영에서 이 변수는 쓰지 않는다. Functions도 FUNCTIONS_EMULATOR=true일 때만 fixture를 사용한다.
4. npx firebase emulators:start --project demo-muzik --only auth,firestore,functions.
5. node scripts/test-beta.mjs. 테스트는 각 실행에 별도 익명 사용자/팀을 만든다. 운영에 연결할 수 없도록 호스트와 demo 프로젝트를 고정했다.
6. npx expo start --web --offline --port 8083. npm run lint.
7. Playwright가 설치된 환경에서 node scripts/test-browser.cjs. 기본 브라우저는 Edge, 독립 컨텍스트 2개, 375/390px.
8. npm run build:demo는 발표 데이터. npm run build:web는 production 필수 설정 검사 후 export. 어떤 export 오류도 성공으로 바꾸지 않는다.

## 출시 전 필요한 결정 및 설정
1. 프로젝트 소유자가 기존 muzik-42b60의 Blaze/결제 연결 여부를 결정해야 한다. 자동 요금제 변경하지 않음. Firebase 공식 Functions 배포 요구사항: https://firebase.google.com/docs/functions/get-started
2. 제안 운영 가드: minInstances=0, maxInstances=2(함수별), concurrency=20, timeout=60초. UID별 생성5/일·가입40/일, IP 해시별 생성20/일·가입150/일, 곡등록/수정40/일, 미리보기60/일. App Check는 운영에서 필수. 이는 정확한 지출 상한이 아니다.
3. 예산 알림 제안: 월 10,000원, 50/90/100% 알림 후 총괄이 당일 사용량 점검. 예산 알림은 과금을 멈추지 않는다. 결제 승인 전 해당 금액도 확정 아님. 읽기/빌드/로그/네트워크 비용은 별도 발생할 수 있다. https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
4. YouTube Data API v3 키를 Secret Manager YOUTUBE_API_KEY로 설정하고 해당 API로 사용 제한. 클라이언트 EXPO_PUBLIC_*에 넣지 않는다. API 쿼터는 베타 관측 후 낮춰 관리한다.
5. Firebase 웹 앱 App Check reCAPTCHA v3 등록, 실제 도메인 등록, EXPO_PUBLIC_RECAPTCHA_SITE_KEY 설정. 사이트 키만 공개 환경변수. https://firebase.google.com/docs/app-check/web/recaptcha-provider
6. Anonymous Auth 현재 활성. Auth 자체 가입 abuse는 Firebase의 IP 가입 제한과 콘솔 사용량을 함께 확인한다. Functions의 App Check/UID 제한만으로 모든 신규 계정 발급을 막을 수는 없다.
7. Vercel 로그인/올바른 팀 프로젝트와 repo 연결 확인. GitHub 인증은 네트워크 권한을 갖춘 재검사에서 정상이며, 인증 오류가 재현될 때만 재로그인한다. Production Branch=main, dev는 통합 전용. Git 설정에서 production only build. https://vercel.com/docs/git

## 배포 순서
이 순서는 결제 결정/키/계정 설정 후 실행한다. 기존 데이터가 있는 프로젝트를 갈아엎지 않는다.

사전 조건: dev 대상 통합 PR의 Node22 CI·리뷰 및 운영 환경 검사 통과, 결제/키/도메인 승인 완료. 원본 데이터·rules·인덱스·정상 배포 ID 보관과 구버전 데이터 스키마 점검을 끝낸다. 아래 순서를 중복 배포 명령 없이 한 번씩 실행한다.

1. **쓰기 중지:** 점검 공지 후 신뢰된 Admin 작업으로 config/app.writesDisabled=true. 구버전 직접쓰기 클라이언트는 이 플래그를 지키지 않으므로 임시 점검 rules로 클라이언트 쓰기 전체도 차단하고, 실제 쓰기 거부를 확인한다. 데이터 읽기는 기존 멤버에게만 허용한다.
2. **서버·인덱스:** `npx firebase deploy --project muzik-42b60 --only functions,firestore:indexes`. 인덱스 준비 완료와 배포된 함수 목록/설정 확인. 쓰기 중지 상태의 요청 거부 확인.
3. **정식 rules:** `npx firebase deploy --project muzik-42b60 --only firestore:rules`. 비로그인·비멤버 읽기 및 모든 클라이언트 직접쓰기 거부를 확인한다. 점검용 rules보다 권한을 넓히지 않는다.
4. **웹:** dev→main 릴리즈 PR을 승인 후 merge하여 기존 정식 Vercel 프로젝트에서 production 빌드. Production Branch=main과 루트 연결을 확인한다. ./dist 별도 프로젝트 생성이나 임시 alias 우회 금지. 쓰기 중지는 유지한다.
5. **검증·개방:** 새 production URL의 로그인/App Check/읽기를 먼저 검사한다. 점검 중 통제된 검증 시간에만 writesDisabled=false로 바꾸고 두 실제 사용자 생성→초대→등록→실시간 반영→재방문, 실 YouTube와 Safari/카카오를 확인한다. 실패하면 즉시 true로 복귀하고 홍보/모집을 보류한다. 통과 후에만 서비스를 개방한다.
6. **구버전 처리:** 남아 있는 직접쓰기 클라이언트는 거부를 유지하고 새로고침/최신 URL을 안내한다. 서버 쓰기 중지·오류 로그를 관찰한다. 호환되지 않는 구버전을 위해 취약 rules를 복구하지 않는다.

## 운영자·신고·측정
- 운영자 custom claim admin=true는 신뢰된 Admin SDK/콘솔 작업자만 부여한다. 일반 클라에는 역할 변경 API가 없다. 역할 부여 후 토큰 갱신/재접속. /admin은 서버 claim 검증 후 신고·피드백·최근100개 이벤트를 보여준다.
- 신고는 이유 enum/대상ID만 저장. 운영 숨김은 moderationArchive에 원문을 보관하고 공개 track은 내용 없는 tombstone으로 대체한다. 하루 슬롯은 유지하고 days 집계/커버에서 제외한다. 개인정보/분쟁 확인이 끝나면 운영자가 보관 기간에 따라 삭제 정책을 확정해야 한다.
- 개인 숨김은 해당 브라우저의 로컬 목록만 바꾼다. 공동 데이터/집계는 유지. 홈의 다시 표시로 해제.
- events: visit(UID당 KST 일1회), team_created, team_joined(신규만), first_registered(팀×UID 최초), next_day_registered(최초 등록 다음 KST 날짜, 1회). timestamp/UID/roomId만 저장하며 닉네임·코멘트·영상 URL은 제외한다.
- 현재 visit 정의는 브라우저 세션 수가 아닌 **일별 방문 UID 수**다. 총괄 홍보 측정표와 이 정의를 맞춰야 한다. /admin 최근100개는 전체 집계가 아니므로 베타 종료 시 Admin 조회로 전체 기간 집계한다. UID는 사람 수가 아니다.
- requests는 입력 해시+응답만 보관. 자동 TTL로 제거하면 아주 늦은 재시도 멱등성이 사라질 수 있어 이번 베타는 유지. rateLimits.expiresAt은 2일로 기록하지만 TTL 설정은 아직 미적용(수동 정리 또는 승인 후 TTL). 이벤트/피드백의 권장 베타 보관 기간은 30일 후 삭제/익명 집계 검토.

## 사고·롤백
- config/app.writesDisabled=true로 팀/곡 쓰기 및 영상 호출을 중단할 수 있다. 신고·피드백·운영검토는 남긴다. 비용 공격 시 App Check/Firebase API 할당량/Functions 상태도 확인한다.
- 재생 실패는 config/app.handoffMode=first_video. 개별 곡 유튜브 이동 버튼은 항상 제공한다.
- 웹은 Vercel 직전의 **안전한 callable 버전**으로 롤백. 기존 직접쓰기 데모 버전이나 느슨한 rules로 되돌리지 않는다. 첫 callable 릴리즈에 안전한 이전 버전이 없으면 점검 화면/쓰기 중단을 유지하며 수정 배포한다.
- 서버는 마지막 검증된 소스와 같은 설정으로 재배포. 데이터/숨김 아카이브를 삭제하거나 전체 DB를 덮어쓰지 않는다. 집계 이상은 원본 tracks 기준으로 검토 후 대상 날짜만 교정한다.

## 미검증
실 Firebase callable/App Check/YouTube API 키 종단 동작, Vercel production main 연동, 실제 Safari/카카오 및 유튜브 연속재생. 에뮬레이터 영상 fixture 성공을 이 항목의 성공으로 해석하지 않는다.
