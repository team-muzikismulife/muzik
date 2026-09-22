# 연결 전 검증 대조표

승인된 일상 흐름과 PWA/운영 범위를 검사 단위에 대응한다. 성공 여부·커밋·CI URL은 PR 최신 체크와 구현 보고를 기준으로 한다. 아래 자동 검사는 실제 휴대폰/외부 계정 연결의 대체물이 아니다.

| 요구                                           | 구현/검사 근거                                      | 경계                                             |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| 참여 중심 홈·최근 팀·오늘 상태                 | Home, core/daily browser                            | 테스트 사용자/실제 로컬 DB                       |
| 초대 미리보기·복귀·재참여 닉네임 보존          | domain safeReturnPath, Auth/Invite, DB/core browser | 실제 OAuth 복귀 미실행                           |
| 정원30·본인 당일1곡·서버KST·직접쓰기 차단      | DB/Edge integration 동시성·RLS·RPC 검사             | 실제 PostgreSQL/Auth/Edge                        |
| 자동 미리보기·역순 응답·붙여넣기 실패          | daily browser                                       | YouTube 메타 fixture                             |
| 응답 유실·401·동일 요청 재확인                 | daily/lifecycle browser, DB 멱등                    | 실제 서버 쓰기와 응답 유실                       |
| 자정·지난 초안 명시 이동·수정 날짜 보존        | domain/daily browser                                | 클라이언트 시계 fixture와 서버 제한 별도         |
| 과거14일 이후·뒤로 날짜/스크롤 복원            | daily browser                                       | 실제 로컬 데이터                                 |
| 큐 UUID·끝/오류·삭제/숨김 갱신                 | domain/daily browser                                | IFrame 이벤트 fixture, 실음악 아님               |
| 닉네임·공유 취소·숨김/복원·메뉴 초점           | daily browser/DB                                    | Web Share/권한 실패 fixture                      |
| 사용자별 초안·로그아웃·계정 교체               | daily browser/local state                           | 실제 로컬 Auth, 외부 provider claim fixture      |
| 초기/미연동/빈/오류·오프라인                   | core/daily/lifecycle browser                        | 가짜 로그인/저장 없음                            |
| cold reopen 본인 초안·멤버십 재확인            | lifecycle browser                                   | 실제 SW 캐시, localUid는 권한 아님               |
| 첫 성공 자동 설치 안내·실제 보이는 닫기        | lifecycle 360/390 viewport 및 hit-test              | 자동 노출 미집계, 강제 설치 없음                 |
| 설치 클릭/수락/standalone·새로고침 상태        | lifecycle + DB + install unit                       | native 설치 이벤트/관련앱/표시 모드 fixture      |
| 업데이트 대기/명시 적용/나중에·구캐시·rollback | lifecycle A/B generateSW                            | 로컬 HTTPS 실제 worker, Vercel rollback 아님     |
| 44px·360/390·큰 글자·키보드 공간               | daily/lifecycle screenshots/geometry                | 실제 OS 키보드 아닌 축소 viewport                |
| 신고 원문 보호·숨김 집계·권한 회수             | DB/Edge + operations browser                        | private 운영 권한, metadata 위조 차단            |
| 피드백 입력/요청 보존·재접수·처리              | lifecycle/DB                                        | 서버 접수, 실패 뒤 수동 확인                     |
| KST 행동 계정 수·운영자 제외                   | DB/Edge + lifecycle metrics                         | 테스트는 격리 DB, 현재 운영자 집계 제외          |
| 고정 origin·version·키 분리                    | release-env unit/build boundary                     | 형식 검사, 소유/권한 확인 아님                   |
| SPA 직접 주소·404·캐시/MIME·아이콘             | test:hosting 로컬 Vercel 설정 계약                  | 실제 Vercel build/DNS/TLS 미검증                 |
| legacy/mock/test 분리                          | 빌드 module graph + Legacy CI                       | 원본 변경/기존 배포 보존                         |

미실행 묶음: 실제 새 Supabase/Google/YouTube/Vercel 연결, 실 두 계정, iPhone/Android/카카오의 설치·완전 종료·복원·실재생·실배포 rollback, 기존 Vercel 목업 프로젝트와 production 영향 최종 확인. [마지막 연결 절차](pwa-release.md)에 필요한 사용자 행동을 모았다.
