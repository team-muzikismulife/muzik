# PWA 구현 현황

2026-09-21 승인된 루트 pwa-rebuild-plan.md 기준. 작업 worktree scratch/pwa-core, codex/pwa-core, 시작 d38a227. 기존 Expo/Firebase와 PR40 보존. 새 패키지 apps/web, 공용 packages/domain, supabase migrations/functions를 추가한다. 기존 RN 전용 frontend/design 규칙의 상태 분리·토큰·접근성 원칙은 유지하고 수단은 승인된 React/Vite/CSS Modules/Query로 교체한다.

1. 공용 순수 계약(날짜·링크·입력)과 DB 트랜잭션/RLS: 공개 테이블 읽기는 멤버만, 쓰기 권한은 클라이언트에서 회수. service_role 전용 RPC도 DB에서 멤버·당일·정원·멱등을 재검증한다. 내부 private 스키마는 API에 노출하지 않는다.
2. Edge가 Auth getUser로 신원을 검증하고 Google 계정을 요구한다. YouTube 키는 서버만, 서버 캐시/제한/성공 요청 선조회 및 장애 후 재조회. 로컬 테스트는 명시적 로컬 Auth/YouTube fixture이며 운영에서 허용하지 않는다.
3. Google 로그인 복귀, 팀 생성·코드·참여, 팀/날짜 조회, 미리보기·곡 CRUD, 현재 열린 팀의 Realtime와 백그라운드 해제. PWA manifest/정적 캐시/사용자 선택 업데이트 기본 shell과 Vercel 정적 SPA 설정.
4. 순수 도메인/빌드/번들 분리/모바일 UI 검사는 로컬. Docker 미설치이므로 Supabase 로컬 DB/권한/Edge/동시성 및 두 브라우저 회귀는 Docker 지원 CI에서 수행한다. 외부 Google/YouTube·실기기·실배포는 별도 증거 없이 통과 표시하지 않는다.

PWA-02A 일상 흐름에 이어 PWA-02B 설치·업데이트, 운영자 신고 처리, 피드백/방문 지표를 구현했다. Supabase migration/Edge와 기본 비인증 경계는 실제 프로젝트에서 확인했다. Google OAuth/YouTube, 두 사용자·실기기·Vercel production은 마지막 검증 단계다. 유료플랜/카드/도메인/옛 배포/실데이터/홍보 조작 없음.

## 일상 흐름 PWA-02A

- 홈은 참여를 우선하고 최근 팀/오늘 등록 상태를 표시한다. 팀에서는 등록 전 추가, 등록 후 모아듣기를 우선한다. 주제는 제안이며 카드에서는 추천자·곡·이유 순으로 보여준다.
- 한 화면에서 링크 입력/붙여넣기, 자동 미리보기, 선택 이유30자를 처리한다. 역순 응답을 버리고 제목/채널은 서버 확인값으로 읽기 전용 제공한다.
- 초안은 사용자·팀·날짜·신규/수정·추천 ID로 분리한다. 저장 전에 요청 ID와 원문을 함께 보관하며 연결 유실/새로고침 후 같은 요청을 재확인한다. gateway401도 재로그인 복귀 경로와 초안을 보존한다.
- 자정 이후 수정 초안은 새 곡으로 바뀌지 않는다. 지난 신규 초안만 확인 후 오늘로 가져오며 오늘 초안이 있으면 추가 확인한다. 오프라인 자동 전송은 하지 않는다.
- YouTube IFrame API로 준비/재생/정지/완료/실패, 연속 재생과 외부 열기를 제공한다. 추천 UUID로 큐를 구분하여 같은 영상/삭제 후 재등록을 혼동하지 않는다. 마지막에서 종료하며 연속 오류는 유한하게 멈춘다.
- 당일 본인 곡 수정/삭제, 다른 곡 개인 숨김/되돌리기/전체 복원/신고 접수, 팀별 닉네임 변경과 단일 초대 공유를 제공한다. 로그아웃은 사용자 초안·숨김·캐시를 정리한다. 신고는 private 테이블에 중복 없이 접수한다.
- 지난 기록은14개씩 추가 조회하고 뒤로 가기 시 날짜 목록·스크롤을 복원한다. 모바일360/390px, 큰 글자, 메뉴 초점, 짧은 입력 화면을 검사한다.
- 기본 shell/팀/편집/플레이어/기록을 분리 로드한다. 승인된 원본 글리프 유지 WOFF2 두 파일과 라이선스를 사용해 폰트 바이트를49.2% 줄였다. 운영 데이터·인증·영상 응답은 오프라인 캐시에 넣지 않는다.

서버 migration `202609210002_daily_flow.sql`은 추천 UUID·private 신고와 날짜/대상 ID 계약을 추가한다. 검증된 API 사용처: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [Supabase Edge 오류](https://supabase.com/docs/guides/functions/error-codes).

## 설치와 운영 PWA-02B

- 홈에서 수동 설치 안내, 첫 실제 등록 성공 후 한 번 자동 제안, 닫은 뒤 7일 자동 억제. 고정 HTTPS origin에서만 설치를 권하며 preview/미연동은 안내만 제공한다. Android 지원 이벤트는 클릭할 때만 실행하고 iPhone Safari/인앱 브라우저 안내를 구분한다. 설치된 표시 모드에서는 안내를 숨긴다.
- 실제 대기 worker를 사용자 확인으로 적용한다. 작성/저장 중 강제 reload가 없으며 미보관 입력과 전송 중에는 적용을 차단한다. 초안과 미확정 요청 ID/payload를 유지하고 나중에 적용·이전 버전 재적용을 제공한다. 정적 파일만 캐시한다.
- 오프라인 cold reopen에서도 기기에 남은 본인 초안으로 진입한다. 로컬 사용자 식별은 서버 세션/팀 권한으로 취급하지 않고, 서버 확인 전에는 등록을 차단한다. 온라인 복귀 시 자동 제출하지 않는다.
- 신뢰된 `private.operators`만 신고 원문/피드백/지표를 조회·처리한다. 숨김은 비공개 원문 보존과 공개 필드 제거·집계/표지 갱신·하루 슬롯 보존을 함께 수행한다. 메타 갱신은 권한·요청 제한·최근5분 캐시와 성공 재조회 계약을 사용한다.
- 피드백은 실제 서버 접수이며 입력/전송 ID를 보관해 응답 유실 후 중복 없이 확인한다. 운영자 메모와 처리 결과는 서버에 보관한다. 일반 사용자는 운영 API와 직접 내부 RPC 접근이 모두 차단된다.
- 방문/설치 안내 수동 진입/설치 요청 버튼 클릭/설치 요청 수락/standalone 실행을 서버 KST 날짜별 계정당 한 번씩 구분한다. 자동 제안 노출은 미집계, 현재 운영자 기록은 집계에서 제외한다. 실패는 핵심 행동을 막지 않으며 무한 재시도·외부 분석·새 추적 ID가 없다. 사용량은 공식 콘솔로 연결하며 잔여 한도나 설치 기기 수를 만들어 표시하지 않는다.

추가 migration은 `202609210003_operations.sql`, 설치 행동 분리/운영자 집계 제외는 `202609210004_install_metrics.sql`. 세부 권한 부여·무료 일시정지·복구·업데이트/rollback 절차는 [운영 문서](pwa-operations.md)를 따른다. [릴리즈 준비](pwa-release.md)에 고정 origin·설정 검사·SPA 경로·원복·마지막 외부 행동을 정리했다.

## 구현된 계약

- getInvitePreview: 로그인 후 요청 제한을 거쳐 이름/isMember/isFull만 반환. 멤버일 때만 복귀용 roomId 제공.
- joinRoom: 기존 팀원은 no-op. 닉네임·가입일을 덮어쓰지 않는다. 신규 가입은 방 잠금으로 정원30 보장.
- updateNickname: 본인 팀 내 닉네임1~8자. 클라이언트 UID 지정 불가.
- 트랙 쓰기: 서버 KST, 본인·멤버 확인, 하루 한 곡, 당일 수정/삭제, 숨김 슬롯 변경 금지. 요청 ID와 입력 해시로 성공 재시도 멱등 보장.
- shared error code/message: 알 수 없는 장애는 UNAVAILABLE. 사용자 입력 오류로 바꾸지 않는다.
- Realtime: 현재 열린 방 revision 업데이트만 구독. 멤버 RLS 적용. 백그라운드에서 구독 해제, 복귀 시 재조회.
- 운영 import 그래프는 tests/examples/legacy 및 Firebase/Expo/React Native 모듈을 거부. Supabase SDK의 ReactNative 환경 감지 문자열 자체는 네이티브 모듈 혼입이 아니므로 문자열만으로 거절하지 않는다.

## 검증 경계

Docker 기반 CI에서 실제 Postgres/RLS/Edge 검사24묶음, 연결 브라우저13건 통과(804f9b3). Google claim·영상 메타데이터·플레이어 이벤트·설치 이벤트/표시 모드는 테스트 fixture다. 실제 Google OAuth/YouTube 재생이나 실제 기기 설치 성공을 뜻하지 않는다. 최신 HEAD 및 브라우저 결과는 launch-worker-report와 PR 체크에서 확인한다.

Legacy 이동 후 타입/웹 빌드/Firebase 서버31/데이터호환6/URL55 회귀가 8c83e14 CI에서 통과했다. 기존 소스는 삭제하지 않았고 목업 import는 legacy에서만 유지한다. 공개 화면은 360/390/1280px 검사와 실제 이미지 로딩을 확인했다. 운영 설정 없는 빌드와 공개 키를 넣은 SDK 포함 빌드 모두 검사한다.
