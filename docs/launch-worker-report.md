# PWA-02A 일상 흐름 구현 보고

2026-09-21. PR [#42](https://github.com/team-muzikismulife/muzik/pull/42), `codex/pwa-core` → `dev` draft. 실제 외부 계정/프로젝트 연결, main 병합, 운영 배포 없음.

## 이번 범위

- 참여 중심 홈과 최근 팀/등록 상태, 추천자 중심 카드, 등록 전후 행동 우선순위.
- 자동 영상 미리보기/역순 응답 방지, 사용자·팀·날짜·추천별 초안, 요청 원문과 ID를 보존하는 저장 재시도, gateway401 재로그인 안내, 자정/오프라인 안전 처리.
- 추천 UUID 기반 IFrame 플레이어와 연속 재생/마지막 종료/연속 오류 정지, 삭제·숨김 큐 갱신. YouTube 외부 열기 병행.
- 곡 더보기, 개인 숨김/복원, 실제 DB 신고 접수, 닉네임, Web Share/복사, 로그아웃 데이터 정리.
  -14일 이후 기록 조회·스크롤 복귀,360/390px·큰 글자·입력 공간, WOFF2와 화면 분리 로드.

## 검증과 한계

- 9f7e0c2: [PWA CI](https://github.com/team-muzikismulife/muzik/actions/runs/35603155298) success, unit16/DB·Edge18묶음/연결 브라우저7 PASS. [Legacy CI](https://github.com/team-muzikismulife/muzik/actions/runs/35603155126) success. 이 후 최종 보완의 CI는 PR 최신 체크 기준.
- 실제 로컬 Postgres/Auth/Edge/Realtime를 CI에서 사용한다. Google provider claim·영상 정보·YouTube 플레이어 이벤트만 테스트 fixture. 실제 OAuth/음악 재생/실기기 검증으로 보지 않는다.
- WOFF2 두 파일1,604,188bytes, 기존3,158,056bytes 대비49.2% 감소. 연결 빌드 최대 청크 약287KB로500KB 경고 해소. 설치 캐시는 정적 파일만 유지한다.
- 숨긴 곡 전체 복원 후 잘못 남던 되돌리기 안내를 제거하고 긴 제목에 넓은 줄을 제공했다. 기록 추가 조회 실패 시 이미 받은 목록을 유지한다.
- PWA-02B: 설치/업데이트 UX, 운영자 신고 처리, 피드백/지표. PWA-03: 실제 Supabase/Google/YouTube/Cloudflare 최종 연결과 실기기 검증.
- PR은 draft 유지. 독립 검토·브랜치 보호·기존 Vercel 자동 배포 영향 확인 전 병합하지 않는다. 연결되지 않은 공개 화면에서 가짜 로그인/저장/팀을 보여주지 않는다.

---

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

| 구분           | 결과                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 로컬 순수 계약 | unit7 PASS                                                                                                                       |
| 웹             | 미연동 build + 공개키 포함 SDK build PASS, 비밀키/fixture/모듈 경계 검사 PASS                                                    |
| Deno           | 운영·테스트 entrypoint 타입 검사 PASS                                                                                            |
| 공개 화면      | Edge 브라우저 360/390/1280px, 가로 넘침/JS 오류 없음, 이미지 로딩/manifest/미연동 상태 검사 PASS                                 |
| Cloudflare     | wrangler deploy --dry-run PASS, 업로드·계정 연결 없음                                                                            |
| CI PWA         | [76ef94f 실행](https://github.com/team-muzikismulife/muzik/actions/runs/35599380945) success: DB/Edge16묶음, 연결 브라우저2 PASS |
| CI legacy      | [8c83e14 실행](https://github.com/team-muzikismulife/muzik/actions/runs/35598934985) success: 서버31/호환6/URL55 + 타입/빌드     |

실제 로컬 Postgres/Auth/Edge/Realtime를 사용한 테스트이며 Google provider claim과 영상 메타데이터만 fixture다. 실제 OAuth·실제 YouTube 검증으로 간주하지 않는다. 이후 문서/체크리스트/화면 artifact 커밋의 최신 CI는 PR 체크에서 확인한다.

## 남은 범위와 출시 가드

- PWA-02: 자동 미리보기 경합, 사용자별 초안/자정 안내, 기록 ID 기반 플레이어/연속재생, 설치 안내, 닉네임 UI·개인숨김·신고/운영·피드백/방문, 스크롤 복원 및 UX 검토 반영.
- 미연동/연결 SDK 포함 번들은 각각 약323KB/543KB minified. 연결 빌드 500KB 경고와 OTF 약3.2MB는 성능 보완 대상으로 남긴다. 경고 기준을 숨기지 않았다.
- 실제 Supabase 계정/프로젝트, Google/YouTube, Cloudflare 연결은 사용자 준비 이후 마지막 단계. 기존 타 서비스 계정/프로젝트 재사용·새 결제·기존 데이터 이전 없음.
- 실제 iOS Safari/Android Chrome/카카오 인앱/설치/업데이트/실음악 재생/무료 한도 운영 검사 미실행.
- 독립 검토·최신 CI·브랜치 보호 요건·기존 Vercel 자동 배포 영향 확인 후에만 병합. 이 PR은 출시 완료가 아니다.
- 외부 연결 체크리스트: pwa-connection.md. 운영 UI에는 목업 팀/가짜 로그인/가짜 저장 성공을 제공하지 않는다.
