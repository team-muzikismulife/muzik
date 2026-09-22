# Vercel 연결 전 릴리즈 준비

현재 단계는 코드·격리 검사·설정/원복 준비다. 실제 Vercel/Supabase 프로젝트 연결, 공개 URL, 사용자 계정, 휴대폰 설치 결과를 확보했다는 뜻이 아니다. 기존 Firebase/Vercel 서비스와 데이터는 변경하지 않는다.

## 고정 구성

- React/Vite 정적 SPA이며 SSR, Vercel Functions, Cron을 사용하지 않는다. 백엔드는 Supabase Auth/PostgreSQL/Edge Functions/Realtime이다.
- Vercel 프로젝트 Root Directory는 저장소 루트 `.`이다. `vercel.json`의 install=`npm --prefix apps/web ci`, build=`npm --prefix apps/web run build:vercel`, output=`apps/web/dist`를 사용한다. `packages/domain`과 루트 설정을 함께 읽기 위해 Root Directory를 `apps/web`로 바꾸지 않는다.
- Production Branch는 `main`이다. `dev`는 통합 브랜치이며 production 주소를 갱신하지 않는다. Project Settings의 Ignored Build Step은 `Only build production`으로 설정해 dev/feature push 배포를 막는다. Preview QA를 다시 켤 때만 이 설정을 재검토한다. [Git/Production Branch](https://vercel.com/docs/git), [Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step).
- 앱 직접 주소 `/login`, `/auth/callback`, `/operations`, `/r/:code`, `/room/*`만 `index.html`로 rewrite한다. 없는 `/assets/*`는 HTML로 바꾸지 않고 404를 반환한다.
- manifest의 `id/start_url/scope`는 `/`, display는 standalone이다. PNG 192/512, maskable 512, Apple 180 아이콘을 빌드에서 실제 PNG로 생성한다.
- `sw.js`, manifest, `index.html`은 매번 재검증하고 해시된 `/assets/*`만 immutable 캐시한다. 인증 callback·팀/API 응답·음악은 Service Worker 런타임 캐시에 넣지 않는다.
- `VITE_PUBLIC_ORIGIN`은 경로·끝 슬래시 없는 production HTTPS origin이다. `VITE_APP_VERSION`은 Vercel의 `VERCEL_GIT_COMMIT_SHA`로만 주입한다. 클라이언트에는 Supabase public URL과 anon/publishable key만 둔다.
- Preview 빌드는 코드상 설치 안내/설치 지표를 차단한다. Preview 로그인 검증이 필요하면 해당 정확한 HTTPS origin만 Supabase redirect와 `WEB_ORIGINS`에 임시 승인하고 검증 뒤 제거한다. 광범위 wildcard는 사용하지 않는다.

## 계정·요금제 보류 조건

이 저장소는 GitHub 조직 `team-muzikismulife` 소유다. Vercel 공식 제한상 Hobby 팀은 Git 조직 소유 저장소를 프로젝트에 연결할 수 없다. 또한 Hobby는 개인·비상업 용도로 제한된다. 소유자는 연결 전에 조직 저장소를 지원하는 적격 Vercel 팀/요금제와 비용 승인을 확인해야 하며, 제한을 우회하기 위한 개인 fork나 별도 배포 경로를 만들지 않는다. [Vercel limits](https://vercel.com/docs/limits#connecting-a-project-to-a-git-repository), [Hobby plan](https://vercel.com/docs/plans/hobby).

이미 공개된 `dist-iota-six-90.vercel.app` Expo 목업은 이 React/Vite 릴리즈의 증거가 아니다. 기존 프로젝트 `muzikismylife/dist`의 소유자, 연결 저장소, Root Directory, Production Branch, 환경변수, 도메인을 인증된 화면에서 먼저 확인한다. 목적이 다르거나 불명확하면 덮어쓰지 않고 새로 승인된 프로젝트를 사용한다.

## 연결 없이 실행하는 검사

저장소 루트에서 Node 22로 실행한다. 로그인, 외부 업로드, Vercel 프로젝트 연결은 하지 않는다.

```sh
npm --prefix apps/web ci
npm test
npm run build
npm --prefix apps/web run check:vercel
npm --prefix apps/web run test:hosting
npm --prefix apps/web run test:browser
```

`check:vercel`은 `vercel.json`과 package scripts의 로컬 계약만 검사한다. `test:hosting`은 포트 4175의 로컬 계약 서버에서 직접 주소, 404, 보안/캐시 헤더, MIME, manifest와 실제 PNG 크기를 검사한다. 둘 다 실제 Vercel build/deploy/DNS/TLS 검증이 아니다. Docker 기반 DB/Auth/Edge/RLS/Realtime 회귀는 CI에서 실행한다.

기본 `build`는 미연동 공개 화면도 만들 수 있다. `build:vercel`은 `VERCEL=1`, production/preview 대상, 유효한 Git SHA, Supabase 공개 설정과 고정 origin이 모두 없으면 실패한다. VITE 비밀키나 service role/YouTube 키가 있으면 대상과 무관하게 실패한다.

## 마지막 연결 순서

아래 행동은 **현재 실행하지 않았다**. 승인된 소유자가 계정과 대상을 확인한 뒤에만 수행하고, 값은 Vercel/Supabase secret에 넣으며 채팅·커밋·캡처에는 남기지 않는다.

1. 적격 Vercel 팀/요금제와 기존 `dist` 프로젝트의 용도를 확인한다. 유료 전환, 카드 등록, 새 프로젝트 생성, 기존 연결 변경은 별도 승인 없이 수행하지 않는다.
2. Vercel 프로젝트의 Root Directory=`.`, Framework=`Vite`, Production Branch=`main`, Ignored Build Step=`Only build production`을 대조한다. install/build/output은 저장소 `vercel.json`을 따른다.
3. Vercel Production 환경에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_ORIGIN`을 설정한다. `VITE_APP_VERSION`은 설정하지 않는다. Preview를 허용할 때는 같은 공개 값의 범위와 OAuth 허용 주소를 별도 검토한다.
4. 새 Supabase 프로젝트를 확인하고 migration dry-run 후 적용한다. `YOUTUBE_API_KEY`, 정확한 HTTPS origin 목록인 `WEB_ORIGINS`를 Edge secrets에 설정하고 운영 `supabase/functions/muzik/index.ts`만 배포한다. `tests/fixtures/edge.ts`는 배포하지 않는다.
5. Supabase Auth Site URL=`<PRODUCTION_ORIGIN>`, redirect=`<PRODUCTION_ORIGIN>/auth/callback`; Google authorized redirect=`https://<PROJECT_REF>.supabase.co/auth/v1/callback`을 대조한다.
6. `feature/* -> dev` CI와 리뷰를 완료한 뒤 `dev -> main` release PR에서 전체 CI와 Vercel build 설정을 확인한다. main merge가 production 배포를 일으킬 수 있으므로 대상 프로젝트 확인 전 merge하지 않는다.
7. 배포 후 HTTPS 응답, 직접 주소, 없는 자산 404, auth callback, manifest/아이콘/SW 버전, 두 Google 계정의 팀·곡·RLS·신고·피드백·Realtime와 실제 YouTube 제한 영상을 확인한다.
8. iPhone Safari/설치 앱, Android Chrome/설치 앱, 카카오 초대에서 설치·완전 종료·재실행·같은 계정 복원, offline cold reopen, 키보드, 업데이트·미확정 요청, 실제 재생을 기록한다.

## 원복

문제 배포는 Vercel Dashboard의 production deployment와 커밋 SHA를 확인한 뒤 Instant Rollback으로 직전 정상 정적 배포를 다시 가리킨다. Hobby는 바로 이전 production으로만 rollback 가능하고, Pro/Enterprise는 적격 이전 배포를 선택할 수 있다. 롤백 뒤 production domain 자동 할당 상태와 현재 Supabase/Edge 계약 호환성을 다시 확인한다. [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment).

DB migration 역실행, 데이터 삭제, Firebase 자동 전환은 웹 롤백 수단이 아니다. 이전 웹이 현재 schema/Edge/초안 version 1과 호환되지 않으면 먼저 전진 수정한다. 실제 Vercel rollback은 아직 실행하지 않았다.

## 병합 보류

기능 PR→dev→main 순서를 유지한다. 자동 병합, force/admin 우회, 기존 실패 체크 삭제를 사용하지 않는다. 인증된 Vercel 화면에서 소유자·프로젝트 용도·Git 연결·Production Branch·Root/build/output·Ignored Build Step·환경변수·도메인·요금제를 확인하고, 독립 리뷰와 최신 CI를 통과하기 전에는 PR을 merge하지 않는다.
