# PWA-03 연결 전 릴리즈 준비

2026-09-21. 실제 서비스 연결·배포·main 병합을 하지 않고, 검토 지적 보완과 통합/릴리즈 준비를 수행했다.

- 자동 설치 안내는 지표를 기록하지 않는다. 수동 안내 진입/설치 요청 버튼 클릭/수락/standalone을 구분하고 KST 해당 행동 계정 수로 표시한다. 서버 집계는 현재 운영자의 과거 기록도 제외한다. 테스트는 격리 DB에서만 실행하며 운영의 테스트 계정을 자동 판별한다고 주장하지 않는다.
- 첫 등록 성공 뒤 저장/화면 이동이 끝나면 본문 상단에 안내한다. 입력 중 자동 이동 없음. 360/390px에서 안내 제목과44px 닫기를 viewport/hit-test로 검증했다. appinstalled 로컬 힌트로 새로고침 뒤 안내를 유지해서 숨기고, 지원 브라우저 관련 앱 조회와 다시 설치 가능 이벤트를 구분한다. 이 힌트를 설치 성공 지표로 사용하지 않는다.
- 정식 build:release에 공개 서버 URL/키·고정 HTTPS·커밋 버전 필수 가드를 추가했다. 로컬 Wrangler SPA 직접 경로·갱신 헤더·PNG 아이콘 검사2개를 추가했다. 기본 미연동 공개 빌드와 실제 운영 연결을 분리한다.
- 설정/명령/원복/마지막 사용자 행동은 pwa-release.md, 승인 범위별 검사 대조는 pwa-acceptance.md, 지표/운영 정의는 pwa-operations.md에 정리했다.
- `9564e3a` [PWA CI35613643678](https://github.com/team-muzikismulife/muzik/actions/runs/35613643678) success: unit23, DB/Edge25묶음, 연결환경 브라우저15(1.3분), 공개1, build/Deno/dry-run. 설치 viewport360/390 artifact 직접 확인. 이후 정적 호스팅 검사/문서의 최종 CI는 PR 최신 체크를 따른다.
- 기존 Vercel production branch/root/build/output/ignored build 설정은 로그인 없이 읽지 못했다. 기존 실패 체크/설정/서비스를 변경하지 않았으며 production 영향 확인 전 병합은 보류한다. 새 계정 연결과 실 Google/YouTube/휴대폰/Cloudflare 검증도 별도 미실행이다.

---

# PWA-02B 설치와 운영 구현 보고

2026-09-21. 기존 PR [#42](https://github.com/team-muzikismulife/muzik/pull/42), `codex/pwa-core` → `dev` draft를 이어 진행했다. main 병합·실제 외부 연결·배포 없음.

## 완료 범위

- 고정 HTTPS 주소의 홈 설치 안내, 첫 실제 등록 성공 후 1회 제안, 닫기7일 억제, 지원 브라우저의 명시 클릭 설치, iPhone Safari/인앱 안내, 설치 상태 숨김. preview에서는 설치를 권하지 않는다.
- 사용자 선택 worker 업데이트와 나중에 적용, 저장/미보관 입력 중 적용 차단, 초안 및 미확정 요청 ID/payload 복구. 실제 두 정적 버전으로 waiting/apply/구캐시 정리/rollback을 검사했다. 다른 탭의 worker 변경에 강제 reload하지 않는다.
- 오프라인 cold reopen 시 본인 초안 접근·편집. 로컬 소유자 정보는 세션이나 팀 권한이 아니며 권한 재확인 전 서버 저장을 막는다. 온라인 자동 제출 없음.
- 서버 운영 권한, 신고 검토/숨김·종결, 비공개 원문 보존/공개 필드 제거/집계·표지·슬롯 일치, 피드백 입력 보존/중복 접수 방지/처리, 메타 갱신5분 캐시와 요청 제한.
- 서버 KST 일 방문·설치 안내·설치 요청 수락·standalone 실행 구분. fixed origin best-effort 계측, 외부 분석/추적 ID/무한 재시도 없음. 공식 사용량 콘솔·무료 일시정지·복구·정적 버전 rollback 안내.
- 피드백 입력 이름과 글자 수를 분리해 접근성을 수정했다. 첫 worker 설치를 업데이트로 표시하지 않도록 보완하고 공개 화면/HTTPS 브라우저 회귀를 추가했다.

## 검증 근거

- `804f9b3`: [PWA CI35610204007](https://github.com/team-muzikismulife/muzik/actions/runs/35610204007) success. unit19, 실제 DB/Edge24묶음, 연결 브라우저13(1.1분), 공개 브라우저1, Deno/빌드/dry-run. [같은 HEAD Legacy CI](https://github.com/team-muzikismulife/muzik/actions/runs/35610204012)와 PR 템플릿도 success.
- 로컬 unit19/build/Deno/dry-run/공개 브라우저1 PASS. 로컬 Docker 미설치로 연결12건은 skip하고 CI에서는 모두 실제 실행했다. 이후 첫 worker 안내 보완의 최신 CI는 PR 체크를 기준으로 한다.
- CI 화면 artifact에서 설치 안내, 입력/업데이트390px, 운영360/390px, 글자200%, 360x420 입력 공간을 확인했다. 긴 피드백 줄바꿈과 버튼 접근을 검사했다. 화면/fixture는 운영 번들에 들어가지 않는다.
- 실제 CI 로컬 Postgres/Auth/Edge/Realtime를 사용한다. Google claim·YouTube 메타/이벤트·설치 이벤트·standalone 표시 모드는 fixture다. 실제 iOS/Android 설치·OAuth·YouTube·Cloudflare rollback 검증으로 표시하지 않는다.

## 남은 외부 검증

사용자가 준비한 새 Supabase 계정/프로젝트와 Google/YouTube/Cloudflare 연결 및 실기기 설치·종료/재실행·같은 계정 복원·업데이트·음악 재생은 마지막 단계에 남긴다. 기존 서비스 프로젝트를 재사용하지 않고, 요금·키·운영 데이터·홍보를 변경하지 않았다. 팀 나가기/새 글로벌 탭은 추가하지 않았다.

독립 검토·최신 CI·브랜치 보호·기존 배포 영향 확인 전 병합하지 않는다. 과거 Vercel 실패를 성공 처리하거나 체크에서 제거하지 않았다. [연결 절차](pwa-connection.md), [운영/복구](pwa-operations.md)를 함께 검토한다.

---

# PWA-02A 일상 흐름 구현 보고

2026-09-21. PR [#42](https://github.com/team-muzikismulife/muzik/pull/42), `codex/pwa-core` → `dev` draft. 실제 외부 계정/프로젝트 연결, main 병합, 운영 배포 없음.

## 이번 범위

- 참여 중심 홈과 최근 팀/등록 상태, 추천자 중심 카드, 등록 전후 행동 우선순위.
- 자동 영상 미리보기/역순 응답 방지, 사용자·팀·날짜·추천별 초안, 요청 원문과 ID를 보존하는 저장 재시도, gateway401 재로그인 안내, 자정/오프라인 안전 처리.
- 추천 UUID 기반 IFrame 플레이어와 연속 재생/마지막 종료/연속 오류 정지, 삭제·숨김 큐 갱신. YouTube 외부 열기 병행.
- 곡 더보기, 개인 숨김/복원, 실제 DB 신고 접수, 닉네임, Web Share/복사, 로그아웃 데이터 정리.
- 14일 이후 기록 조회·스크롤 복귀,360/390px·큰 글자·입력 공간, WOFF2와 화면 분리 로드.

## 검증과 한계

- 6e0a429: [PWA CI](https://github.com/team-muzikismulife/muzik/actions/runs/35604917608) success, unit16/DB·Edge18묶음/연결 브라우저8 PASS. 지난 신규 초안 이동 확인·공유 취소·붙여넣기 실패·이미지 실패 화면 포함. 이전 [Legacy CI](https://github.com/team-muzikismulife/muzik/actions/runs/35603155126) success. 이후 최종 보완의 CI는 PR 최신 체크 기준.
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
