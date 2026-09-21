# MUZIK

하루 한 곡씩 우리 팀의 음악을 쌓는 모바일 웹 PWA.

## 현재 상태

React/Vite 웹, Supabase 서버 계약과 권한, Cloudflare 정적 배포 설정을 구현 중입니다. 실 Supabase 프로젝트와 Google/YouTube 연결 및 운영 배포는 아직 하지 않았습니다. 설정 없이도 공개 화면은 열리며 로그인·저장 성공을 가장하지 않습니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `apps/web` | 유일한 운영 웹 앱. React, Vite, TanStack Query, CSS Modules |
| `packages/domain` | 웹·Edge 공통 입력 검증, 날짜와 테마 계약 |
| `supabase` | PostgreSQL 스키마, RLS, Edge Functions |
| `tests` | unit / integration / e2e / fixtures. 운영에서 import 금지 |
| `examples/mock` | 이전 Expo 목업. 운영 데이터 아님 |
| `legacy/expo`, `legacy/firebase`, `legacy/native` | 이전 구현 보존. 신규 운영 빌드에 포함 안 됨 |
| `docs/archive` | 이전 설계·Firebase 베타 이력. 현재 운영 지침 아님 |

## 개발

Node.js 22를 사용합니다. 운영 웹은 아래 명령만으로 실행됩니다.

```sh
npm --prefix apps/web ci
npm run dev
npm test
npm run build
npm --prefix apps/web run deploy:check
```

환경변수는 `apps/web/.env.example`을 참고합니다. 공개 URL/publishable key만 웹에 넣고 YouTube/API service role 키는 절대 넣지 않습니다. build는 `apps/web/dist`만 생성하며 배포 명령을 자동 실행하지 않습니다.

브라우저 검사: `cd apps/web`에서 `npx playwright install chromium`, `npm run test:browser`. 로컬 Supabase 통합 검사는 Docker가 필요하며 `.github/workflows/pwa.yml`의 격리 절차를 따릅니다. 테스트 서버는 실제 Google OAuth/YouTube 검증을 대체하지 않습니다.

Legacy 검사는 `legacy/expo`, `legacy/firebase/functions`에서 각각 `npm ci` 후 루트의 `npm run legacy:build`로 실행합니다. 관련 테스트는 별도 Legacy Compatibility CI에서 실행합니다. 신규 운영 명령에서 legacy 배포는 하지 않습니다.

## 배포와 브랜치

- `dev`: 통합. production 자동 배포 금지.
- `main`: 검토·CI를 통과한 안정 코드. 코드 병합과 실제 서비스 연결은 별개입니다.
- feature 작업은 `dev`로 PR. production 수정은 main 반영 후 dev에 동기화합니다.
- Cloudflare 배포 루트는 `apps/web`. 기존 Vercel/Firebase 설정은 `legacy`에만 보존하며 이전 연결의 자동 배포 영향은 병합 전에 별도 확인합니다.

[구현 현황](docs/pwa-implementation.md) · [마지막 외부 연결 절차](docs/pwa-connection.md)
