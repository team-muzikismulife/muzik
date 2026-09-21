# PWA-01 구현 계획

2026-09-21 승인된 루트 pwa-rebuild-plan.md 기준. 작업 worktree scratch/pwa-core, codex/pwa-core, 시작 d38a227. 기존 Expo/Firebase와 PR40 보존. 새 패키지 apps/web, 공용 packages/domain, supabase migrations/functions를 추가한다. 기존 RN 전용 frontend/design 규칙의 상태 분리·토큰·접근성 원칙은 유지하고 수단은 승인된 React/Vite/CSS Modules/Query로 교체한다.

1. 공용 순수 계약(날짜·링크·입력)과 DB 트랜잭션/RLS: 공개 테이블 읽기는 멤버만, 쓰기 권한은 클라이언트에서 회수. service_role 전용 RPC도 DB에서 멤버·당일·정원·멱등을 재검증한다. 내부 private 스키마는 API에 노출하지 않는다.
2. Edge가 Auth getUser로 신원을 검증하고 Google 계정을 요구한다. YouTube 키는 서버만, 서버 캐시/제한/성공 요청 선조회 및 장애 후 재조회. 로컬 테스트는 명시적 로컬 Auth/YouTube fixture이며 운영에서 허용하지 않는다.
3. Google 로그인 복귀, 팀 생성·코드·참여, 팀/날짜 조회, 미리보기·곡 CRUD, 현재 열린 팀의 Realtime와 백그라운드 해제. PWA manifest/정적 캐시/사용자 선택 업데이트 기본 shell과 Cloudflare Static Assets 설정.
4. 순수 도메인/빌드/번들 분리/모바일 UI 검사는 로컬. Docker 미설치이므로 Supabase 로컬 DB/권한/Edge/동시성 및 두 브라우저 회귀는 Docker 지원 CI에서 수행한다. 외부 Google/YouTube·실기기·실배포는 별도 증거 없이 통과 표시하지 않는다.

PWA-02 범위: 설치 제안·사용자별 초안/자정·개인숨김·신고/운영 UI·피드백/방문·플레이어/연속재생/스크롤 복원 등 UX 완성. PWA-01의 서버 구조는 이 후속 기능을 안전하게 확장할 수 있도록 최소한으로 준비한다. 유료플랜/카드/도메인/옛 배포/실데이터/홍보 조작 없음.
