# PWA-01 기반 구현 보고

2026-09-21. PR [#42](https://github.com/team-muzikismulife/muzik/pull/42), 이슈 [#41](https://github.com/team-muzikismulife/muzik/issues/41), `codex/pwa-core` → `dev` draft. main 병합/실배포 없음. 과거 Firebase 보고는 docs/archive/launch-worker-report.md에 보존.

## 완료 범위

- React/Vite/CSS Modules/Query 운영 웹, optional Supabase 설정. 미연동 공개 화면에서는 로그인·저장 성공을 가장하지 않는다.
- Google OAuth 코드 교환/안전한 복귀/세션 캐시 정리, 팀 생성·초대·참여, 날짜 조회, 영상 미리보기·곡 CRUD, 열린 팀 Realtime.
- 공용 날짜/테마/검증/오류 계약, PostgreSQL migration/RLS/서비스 전용 RPC, 서버 신원 확인과 YouTube 검증.
- getInvitePreview/updateNickname, 기존 참여자 no-op, 서버 KST/정원30/본인당일/중복요청/숨김슬롯 검증.
- manifest/icons/정적 캐시/사용자 확인 업데이트, Cloudflare assets 설정과 dry-run.
- legacy/examples/tests 분리. 이전 구현·목업은 보존하지만 운영 번들에는 포함하지 않는다.

## 검증 근거

| 구분 | 결과 |
| --- | --- |
| 로컬 순수 계약 | unit7 PASS |
| 웹 | 미연동 build + 공개키 포함 SDK build PASS, 비밀키/fixture/모듈 경계 검사 PASS |
| Deno | 운영·테스트 entrypoint 타입 검사 PASS |
| 공개 화면 | Edge 브라우저 360/390/1280px, 가로 넘침/JS 오류 없음, 이미지 로딩/manifest/미연동 상태 검사 PASS |
| Cloudflare | wrangler deploy --dry-run PASS, 업로드·계정 연결 없음 |
| CI PWA | [76ef94f 실행](https://github.com/team-muzikismulife/muzik/actions/runs/35599380945) success: DB/Edge16묶음, 연결 브라우저2 PASS |
| CI legacy | [8c83e14 실행](https://github.com/team-muzikismulife/muzik/actions/runs/35598934985) success: 서버31/호환6/URL55 + 타입/빌드 |

실제 로컬 Postgres/Auth/Edge/Realtime를 사용한 테스트이며 Google provider claim과 영상 메타데이터만 fixture다. 실제 OAuth·실제 YouTube 검증으로 간주하지 않는다. 이후 문서/체크리스트/화면 artifact 커밋의 최신 CI는 PR 체크에서 확인한다.

## 남은 범위와 출시 가드

- PWA-02: 자동 미리보기 경합, 사용자별 초안/자정 안내, 기록 ID 기반 플레이어/연속재생, 설치 안내, 닉네임 UI·개인숨김·신고/운영·피드백/방문, 스크롤 복원 및 UX 검토 반영.
- 미연동/연결 SDK 포함 번들은 각각 약323KB/543KB minified. 연결 빌드 500KB 경고와 OTF 약3.2MB는 성능 보완 대상으로 남긴다. 경고 기준을 숨기지 않았다.
- 실제 Supabase 계정/프로젝트, Google/YouTube, Cloudflare 연결은 사용자 준비 이후 마지막 단계. 기존 타 서비스 계정/프로젝트 재사용·새 결제·기존 데이터 이전 없음.
- 실제 iOS Safari/Android Chrome/카카오 인앱/설치/업데이트/실음악 재생/무료 한도 운영 검사 미실행.
- 독립 검토·최신 CI·브랜치 보호 요건·기존 Vercel 자동 배포 영향 확인 후에만 병합. 이 PR은 출시 완료가 아니다.
- 외부 연결 체크리스트: pwa-connection.md. 운영 UI에는 목업 팀/가짜 로그인/가짜 저장 성공을 제공하지 않는다.
