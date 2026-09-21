# 연결 전 릴리즈 준비

현재 단계는 코드·격리 검사·설정/원복 준비다. 실제 프로젝트, 공개 URL, 사용자 계정, 휴대폰 설치 결과를 확보했다는 뜻이 아니다. 기존 Firebase/Vercel 서비스와 데이터는 변경하지 않는다.

## 고정 구성

- 운영 루트 `apps/web`, 산출물 `apps/web/dist`. React SPA이며 별도 상시 서버/SSR 없음. Cloudflare Workers Static Assets의 `muzik-pwa`라는 이름은 신규 서비스용 설정이며 실제 사용 가능 여부는 연결 시 확인한다.
- 한 번 선택한 무료 HTTPS `<worker>.<subdomain>.workers.dev` origin을 유지한다. 구매 도메인 없음. `preview_urls:false`이며 preview에는 설치를 유도하지 않는다.
- manifest의 `id/start_url/scope`는 `/`, standalone. PNG192/512/maskable과 Apple 아이콘은 빌드 생성한다. 같은 origin의 manifest를 관련 앱으로 선언하며 native 앱 우선 설치는 설정하지 않는다.
- `VITE_PUBLIC_ORIGIN`은 경로·끝 슬래시 없는 정식 HTTPS origin, `VITE_APP_VERSION`은 검토한 Git 커밋 SHA. 웹 Supabase URL/anon 또는 publishable key만 공개 가능하다. service role/YouTube 키는 Edge만 사용한다.
- `WEB_ORIGINS`는 정확한 웹 origin의 쉼표 구분 목록이며 wildcard를 쓰지 않는다. 브라우저 `/auth/callback`과 Google provider callback을 혼동하지 않는다.
- Supabase Auth Site URL=`<WEB_ORIGIN>`, 허용 redirect=`<WEB_ORIGIN>/auth/callback`. Google OAuth의 authorized redirect=`https://<PROJECT_REF>.supabase.co/auth/v1/callback`. 실제 배포 전에 대조하고 로그에 authorization code/token을 남기지 않는다.

## 연결 없이 실행하는 검사

저장소 루트에서 Node22로 실행한다. 로그인/클라우드 업로드는 하지 않는다.

```sh
npm --prefix apps/web ci
npm test
npm run build
npm --prefix apps/web run deploy:check
npm --prefix apps/web run test:assets
npm --prefix apps/web run test:browser
```

`test:assets`는 로컬 Wrangler만 띄워 SPA 직접 진입, 정적 헤더, manifest와 실제 PNG 크기를 검사하고 종료한다. 포트4175가 이미 사용 중이면 기존 서버를 재사용하지 않고 실패한다. Docker 기반 실제 DB/Auth/Edge/RLS/Realtime 회귀는 CI에서 실행한다. Google/YouTube/설치 표시 모드만 fixture이며 운영 import·번들에서 차단한다.

미연동 `build`는 공개 대기 화면용이다. `build:release`는 공개 서버 URL/키·고정 origin·버전이 없거나 로컬 서버/비밀키이면 실패한다. 검사 통과는 설정 형식 확인일 뿐 소유권/실인증/실재생 확인이 아니다.

## 마지막 연결 순서

아래 명령은 **현재 실행하지 않았다**. 사용자가 새 계정과 소유 프로젝트를 준비하고 최종 검토를 통과한 뒤에만 실행한다. 값은 안전한 로컬 환경/배포 secret에 넣고 채팅·커밋·캡처에는 넣지 않는다.

1. Supabase/Google/Cloudflare의 새 MUZIK 대상·무료 한도·권한을 확인한다. 기존 다른 서비스 프로젝트/계정을 연결하지 않는다. 카드·유료 플랜·프로젝트 삭제를 요구하면 중단한다.
2. 새 프로젝트 ref와 DB migration 적용 대상을 확인한 뒤 루트에서 다음을 실행한다. `db reset` 또는 기존 데이터 자동 이관은 하지 않는다.

```sh
npm exec --prefix apps/web -- supabase link --project-ref <PROJECT_REF>
npm exec --prefix apps/web -- supabase db push --linked --dry-run
npm exec --prefix apps/web -- supabase db push --linked
npm exec --prefix apps/web -- supabase secrets set --project-ref <PROJECT_REF> --env-file <UNTRACKED_SERVER_ENV>
npm exec --prefix apps/web -- supabase functions deploy muzik --project-ref <PROJECT_REF>
```

3. 서버 환경 파일에는 `YOUTUBE_API_KEY`, `WEB_ORIGINS`만 넣는다. Supabase가 제공하는 URL/anon/service_role 환경은 해당 프로젝트 것으로 검증한다. 운영 entrypoint는 `supabase/functions/muzik/index.ts`이고 테스트 `tests/fixtures/edge.ts`를 배포하지 않는다. gateway JWT 검사를 끄지 않는다. handler도 `auth.getUser()`로 실제 Google 사용자를 검증한다. [공식 인증 헤더](https://supabase.com/docs/guides/functions/auth-headers).
4. 웹 공개 설정 네 개를 준비하고 `npm --prefix apps/web run build:release`, `deploy:check`, `test:assets`를 실행한다. 환경이 바뀌면 재빌드한다. 직전 정상 dist·커밋·manifest·공개 환경 이름·배포 버전을 안전하게 보존한다.
5. Cloudflare 연결 후 `apps/web`에서 `npx wrangler whoami`로 대상 계정, `npx wrangler deployments list`로 같은 이름의 기존 서비스 유무를 확인한다. 기존 타 서비스이면 덮어쓰지 않는다. 검토된 새 대상에만 `npx wrangler deploy`한다. CI에는 자동 production 배포를 추가하지 않았다.
6. 실제 HTTPS 응답, `/r/<code>`·`/room/<id>` 직접 진입, 인증 복귀, manifest/아이콘/버전, 두 Google 계정의 생성·초대·곡 CRUD·RLS·신고·피드백·Realtime와 실제 YouTube 제한 영상을 확인한다. 실패하면 모집하지 않는다.
7. iPhone Safari/설치 앱, Android Chrome/설치 앱, 카카오 초대에서 설치·완전 종료·재실행·같은 계정 복원, 키보드, offline cold reopen, 업데이트·미확정 요청, 실제 재생을 기록한다. 테스트 화면/영상으로 실제 사용자 모집 자료를 대체하지 않는다.

## 캐시와 원복

Cloudflare SPA fallback은 HTML을 제공한다. 없는 JS 경로도 fallback HTML일 수 있으며 `nosniff`와 HTML Content-Type으로 스크립트 실행을 막는다. 브라우저 동적 import 실패는 앱 오류 경계의 재시도로 복구한다. 별도 Worker/API 우회 경로를 추가하지 않는다. [SPA 공식 동작](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

`_headers`는 SW/manifest/index의 재검증과 MIME 보호를 설정한다. canonical `/`와 SPA 응답은 Cloudflare 기본 `max-age=0,must-revalidate`를 사용한다. SW는 정적 precache만 사용하고 인증 callback·팀/API 응답·음악은 저장하지 않는다. [정적 헤더 규칙](https://developers.cloudflare.com/workers/static-assets/headers/).

문제 배포는 현재 DB/Edge와 호환되는 직전 정상 정적 버전으로 같은 주소에서 되돌린다. `apps/web`에서 `npx wrangler deployments list`, `npx wrangler rollback <VERSION_ID>`로 대상과 차이를 확인한 뒤 사용자가 이전 버전 업데이트를 선택하게 한다. migration 역실행/데이터 삭제/Firebase 자동 전환은 하지 않는다. 실제 Cloudflare rollback은 아직 미실행이며 [공식 제약](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)과 [운영 복구 지침](pwa-operations.md)을 따른다.

## 병합 전 보류 조건

기능 PR→dev→main 순서를 유지한다. main/dev 고유 이력은 통합 브랜치에서 먼저 병합·충돌 해결하고 전체 CI를 실행한다. 자동 병합/force/admin 우회/기존 실패 체크 삭제를 사용하지 않는다.

현재 기존 Vercel 프로젝트의 production branch/root/build/output/ignored build 설정을 인증 없이 읽지 못했다. GitHub의 실패 상태와 저장소의 legacy 설정만으로 production 영향이 없다고 보증할 수 없다. 소유자가 기존 프로젝트의 해당 설정과 Git 연동을 한 번에 확인해야 한다. 실제 필수 리뷰/규칙과 독립 검토를 확인한 뒤에만 병합한다. Supabase 계정이 아직 없다는 이유로 위 코드/검사/문서 준비를 생략하지 않는다.
