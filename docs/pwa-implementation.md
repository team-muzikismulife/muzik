# PWA 구현 현황

2026-09-21 승인된 루트 pwa-rebuild-plan.md 기준. 작업 worktree scratch/pwa-core, codex/pwa-core, 시작 d38a227. 기존 Expo/Firebase와 PR40 보존. 새 패키지 apps/web, 공용 packages/domain, supabase migrations/functions를 추가한다. 기존 RN 전용 frontend/design 규칙의 상태 분리·토큰·접근성 원칙은 유지하고 수단은 승인된 React/Vite/CSS Modules/Query로 교체한다.

1. 공용 순수 계약(날짜·링크·입력)과 DB 트랜잭션/RLS: 공개 테이블 읽기는 멤버만, 쓰기 권한은 클라이언트에서 회수. service_role 전용 RPC도 DB에서 멤버·당일·정원·멱등을 재검증한다. 내부 private 스키마는 API에 노출하지 않는다.
2. Edge가 Auth getUser로 신원을 검증하고 Google 계정을 요구한다. YouTube 키는 서버만, 서버 캐시/제한/성공 요청 선조회 및 장애 후 재조회. 로컬 테스트는 명시적 로컬 Auth/YouTube fixture이며 운영에서 허용하지 않는다.
3. Google 로그인 복귀, 팀 생성·코드·참여, 팀/날짜 조회, 미리보기·곡 CRUD, 현재 열린 팀의 Realtime와 백그라운드 해제. PWA manifest/정적 캐시/사용자 선택 업데이트 기본 shell과 Cloudflare Static Assets 설정.
4. 순수 도메인/빌드/번들 분리/모바일 UI 검사는 로컬. Docker 미설치이므로 Supabase 로컬 DB/권한/Edge/동시성 및 두 브라우저 회귀는 Docker 지원 CI에서 수행한다. 외부 Google/YouTube·실기기·실배포는 별도 증거 없이 통과 표시하지 않는다.

PWA-02A는 아래 일상 흐름을 구현했다. PWA-02B에 설치·업데이트 마무리, 운영자 신고 처리, 피드백/방문 지표를 남긴다. 실제 외부 서비스 연결은 마지막 단계다. 유료플랜/카드/도메인/옛 배포/실데이터/홍보 조작 없음.

## 일상 흐름 PWA-02A

- 홈은 참여를 우선하고 최근 팀/오늘 등록 상태를 표시한다. 팀에서는 등록 전 추가, 등록 후 모아듣기를 우선한다. 주제는 제안이며 카드에서는 추천자·곡·이유 순으로 보여준다.
- 한 화면에서 링크 입력/붙여넣기, 자동 미리보기, 선택 이유30자를 처리한다. 역순 응답을 버리고 제목/채널은 서버 확인값으로 읽기 전용 제공한다.
- 초안은 사용자·팀·날짜·신규/수정·추천 ID로 분리한다. 저장 전에 요청 ID와 원문을 함께 보관하며 연결 유실/새로고침 후 같은 요청을 재확인한다. gateway401도 재로그인 복귀 경로와 초안을 보존한다.
- 자정 이후 수정 초안은 새 곡으로 바뀌지 않는다. 지난 신규 초안만 확인 후 오늘로 가져오며 오늘 초안이 있으면 추가 확인한다. 오프라인 자동 전송은 하지 않는다.
- YouTube IFrame API로 준비/재생/정지/완료/실패, 연속 재생과 외부 열기를 제공한다. 추천 UUID로 큐를 구분하여 같은 영상/삭제 후 재등록을 혼동하지 않는다. 마지막에서 종료하며 연속 오류는 유한하게 멈춘다.
- 당일 본인 곡 수정/삭제, 다른 곡 개인 숨김/되돌리기/전체 복원/신고 접수, 팀별 닉네임 변경과 단일 초대 공유를 제공한다. 로그아웃은 사용자 초안·숨김·캐시를 정리한다. 신고는 private 테이블에 중복 없이 접수하며 운영 처리 UI는 아직 없다.
- 지난 기록은14개씩 추가 조회하고 뒤로 가기 시 날짜 목록·스크롤을 복원한다. 모바일360/390px, 큰 글자, 메뉴 초점, 짧은 입력 화면을 검사한다.
- 기본 shell/팀/편집/플레이어/기록을 분리 로드한다. 승인된 원본 글리프 유지 WOFF2 두 파일과 라이선스를 사용해 폰트 바이트를49.2% 줄였다. 운영 데이터·인증·영상 응답은 오프라인 캐시에 넣지 않는다.

서버 migration `202609210002_daily_flow.sql`은 추천 UUID·private 신고와 날짜/대상 ID 계약을 추가한다. 검증된 API 사용처: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [Supabase Edge 오류](https://supabase.com/docs/guides/functions/error-codes).

## 구현된 계약

- getInvitePreview: 로그인 후 요청 제한을 거쳐 이름/isMember/isFull만 반환. 멤버일 때만 복귀용 roomId 제공.
- joinRoom: 기존 팀원은 no-op. 닉네임·가입일을 덮어쓰지 않는다. 신규 가입은 방 잠금으로 정원30 보장.
- updateNickname: 본인 팀 내 닉네임1~8자. 클라이언트 UID 지정 불가.
- 트랙 쓰기: 서버 KST, 본인·멤버 확인, 하루 한 곡, 당일 수정/삭제, 숨김 슬롯 변경 금지. 요청 ID와 입력 해시로 성공 재시도 멱등 보장.
- shared error code/message: 알 수 없는 장애는 UNAVAILABLE. 사용자 입력 오류로 바꾸지 않는다.
- Realtime: 현재 열린 방 revision 업데이트만 구독. 멤버 RLS 적용. 백그라운드에서 구독 해제, 복귀 시 재조회.
- 운영 import 그래프는 tests/examples/legacy 및 Firebase/Expo/React Native 모듈을 거부. Supabase SDK의 ReactNative 환경 감지 문자열 자체는 네이티브 모듈 혼입이 아니므로 문자열만으로 거절하지 않는다.

## 검증 경계

Docker 기반 CI에서 실제 Postgres/RLS/Edge 검사18묶음 통과(9f7e0c2). Google claim·영상 메타데이터·플레이어 이벤트는 테스트 fixture다. 실제 Google OAuth/YouTube 재생 성공을 뜻하지 않는다. 최신 HEAD 및 두 사용자 브라우저 결과는 launch-worker-report에 기록한다.

Legacy 이동 후 타입/웹 빌드/Firebase 서버31/데이터호환6/URL55 회귀가 8c83e14 CI에서 통과했다. 기존 소스는 삭제하지 않았고 목업 import는 legacy에서만 유지한다. 공개 화면은 360/390/1280px 검사와 실제 이미지 로딩을 확인했다. 운영 설정 없는 빌드와 공개 키를 넣은 SDK 포함 빌드 모두 검사한다.
