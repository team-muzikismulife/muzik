# MUZIK

하루 한 곡씩 우리 팀의 음악을 쌓는 모바일 웹 PWA.

## 현재 상태

React/Vite 웹, Supabase 서버 계약과 권한, Vercel 정적 배포 설정을 구현 중입니다. 승인된 Supabase 프로젝트에는 migration과 `muzik` Edge Function이 적용됐고 기본 비인증 경계를 확인했습니다. Google/YouTube 실연결, 두 사용자 흐름, 실기기 PWA와 Vercel production 배포는 아직 검증하지 않았습니다. 설정 없이도 공개 화면은 열리며 로그인·저장 성공을 가장하지 않습니다.

일상 사용 흐름에는 팀 참여, 자동 영상 확인, 사용자·팀·날짜별 초안과 저장 재시도, 추천 기록별 모아듣기, 지난 기록, 개인 숨김·신고·닉네임 변경이 포함됩니다. 고정 주소 설치 안내, 사용자 선택 업데이트, 오프라인 재실행 초안, 운영자 신고 처리, 피드백·최소 지표도 구현했습니다. 코드와 격리 테스트 완료는 실제 서비스 출시 완료를 뜻하지 않습니다.

## 구조

| 경로                                              | 역할                                                        |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web`                                        | 유일한 운영 웹 앱. React, Vite, TanStack Query, CSS Modules |
| `packages/domain`                                 | 웹·Edge 공통 입력 검증, 날짜와 테마 계약                    |
| `supabase`                                        | PostgreSQL 스키마, RLS, Edge Functions                      |
| `tests`                                           | unit / integration / e2e / fixtures. 운영에서 import 금지   |
| `examples/mock`                                   | 이전 Expo 목업. 운영 데이터 아님                            |
| `legacy/expo`, `legacy/firebase`, `legacy/native` | 이전 구현 보존. 신규 운영 빌드에 포함 안 됨                 |
| `docs/archive`                                    | 이전 설계·Firebase 베타 이력. 현재 운영 지침 아님           |

## 개발

Node.js 22를 사용합니다. 운영 웹은 아래 명령만으로 실행됩니다.

```sh
npm --prefix apps/web ci
npm run dev
npm test
npm run build
npm --prefix apps/web run check:vercel
npm --prefix apps/web run test:hosting
```

환경변수는 `apps/web/.env.example`을 참고합니다. 공개 URL/publishable key만 웹에 넣고 YouTube/API service role 키는 절대 넣지 않습니다. build는 `apps/web/dist`만 생성하며 배포 명령을 자동 실행하지 않습니다.

브라우저 검사: `cd apps/web`에서 `npx playwright install chromium`, `npm run test:browser`. 로컬 Supabase 통합 검사는 Docker가 필요하며 `.github/workflows/pwa.yml`의 격리 절차를 따릅니다. 테스트 서버는 실제 Google OAuth/YouTube 검증을 대체하지 않습니다.

Legacy 검사는 `legacy/expo`, `legacy/firebase/functions`에서 각각 `npm ci` 후 루트의 `npm run legacy:build`로 실행합니다. 관련 테스트는 별도 Legacy Compatibility CI에서 실행합니다. 신규 운영 명령에서 legacy 배포는 하지 않습니다.

## 배포와 브랜치

- `dev`: 통합. production 자동 배포 금지.
- `main`: 검토·CI를 통과한 안정 코드. 코드 병합과 실제 서비스 연결은 별개입니다.
- feature 작업은 `dev`로 PR. production 수정은 main 반영 후 dev에 동기화합니다.
- Vercel 프로젝트 루트는 저장소 루트(`.`), Production Branch는 `main`, 산출물은 `apps/web/dist`입니다. `dev`와 feature 브랜치는 production으로 승격하지 않습니다.
- 기존 Vercel/Firebase 목업 프로젝트는 자동 재사용하지 않습니다. 소유자·Git 연결·요금제·프로젝트 설정을 확인하기 전에는 연결하거나 덮어쓰지 않습니다.

[구현 현황](docs/pwa-implementation.md) · [마지막 외부 연결 절차](docs/pwa-connection.md) · [운영과 복구](docs/pwa-operations.md) · [릴리즈 실행 순서](docs/pwa-release.md) · [검증 대조표](docs/pwa-acceptance.md)

정식 연결 빌드는 Vercel의 `npm --prefix apps/web run build:vercel`이 시스템 커밋 SHA를 주입해 수행합니다. 고정 HTTPS origin·공개 Supabase 설정·커밋 버전이 없으면 중단합니다. `test:hosting`은 Vercel 설정을 로컬에서 재현해 SPA 직접 진입, 404, 캐시, MIME과 실제 아이콘을 검사하며 외부 업로드를 하지 않습니다.
