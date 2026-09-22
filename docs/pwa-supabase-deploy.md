# Supabase CLI 적용·확인 절차

2026-09-22 승인 프로젝트 `dtljjrvkfuotriivrdza`에 migration 네 개와 `muzik` Edge Function을 적용했다. 이 문서는 실제 적용 상태와 재확인 절차를 함께 기록한다. 비밀값을 명령 인수, 채팅, transcript 또는 파일에 남기지 않는다.

## 현재 적용 상태

- 공식 CLI 브라우저 인증을 `login --no-browser --name muzik-pwa --profile supabase --agent no`로 완료했고, `projects list`에서 승인 대상과 조직을 대조했다. `--name`은 저장 토큰 이름이며 계정 격리 profile이 아니다.
- `supabase/.temp/project-ref`는 승인 ref와 일치한다. CLI가 만든 임시 login role로 DB 명령이 동작했으며 수동 DB 비밀번호 입력은 필요하지 않았다.
- `202609210001`~`202609210004`를 적용했다. 최신 `migration list`의 Local/Remote가 모두 일치하고 dry-run은 remote database up to date였다.
- Edge secret `WEB_ORIGINS`에는 정확한 production origin `https://muzik-pwa.vercel.app`이 설정됐다. `muzik` 함수는 ACTIVE/version 1/`verify_jwt=true`다.
- 읽기 전용 운영 확인에서 익명 role의 `rooms`, `members`, `tracks`, `days` 조회는 모두 HTTP 401/SQLSTATE `42501`, API 미노출 private schema 조회는 HTTP 406/`PGRST106`이었다. 승인 origin preflight는 204와 정확한 ACAO를 반환하고, 미승인 origin은 403과 ACAO 없음이었다. 인증 헤더 없음·잘못된 JWT·anon JWT의 Edge POST는 모두 401이었다.
- 위 결과는 backend 연결·기본 비인증 경계를 확인한 것이다. 실제 Google OAuth, YouTube API/재생, 두 사용자 흐름, 실기기 PWA, Vercel production 배포 성공을 뜻하지 않는다.

## 인증과 대상 확인

CLI 2.117.0에서 `--profile muzik-pwa`는 계정 별칭이 아니라 설정 파일 경로로 해석될 수 있다. 공식 production endpoint에는 `--profile supabase`를 사용한다. [profile loader](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-profile-load.ts).

기본 경로는 CLI가 표시하는 URL을 승인된 MUZIK 계정으로 여는 브라우저 인증이다. 새 브라우저나 다른 계정을 임의로 사용하지 않는다.

```powershell
$muzikCli = Join-Path (Get-Location) 'apps/web/node_modules/.bin/supabase.cmd'
& $muzikCli login --no-browser --name muzik-pwa --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Supabase login failed.' }
& $muzikCli projects list --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Project lookup failed.' }
```

`login`은 로컬 자격 저장소를 사용한다. 이미 승인된 MUZIK 자격이 저장된 현재 환경에서는 불필요하게 다시 로그인하지 않는다. Personal Access Token과 `SUPABASE_DB_PASSWORD`는 자동 로그인 또는 임시 login role이 실패할 때만 쓰는 대안이며 필수 선행값이 아니다. 대안이 필요하면 사용자가 새 터미널의 세션 환경변수로 직접 입력하고 출력하지 않는다. [공식 CLI 인증](https://supabase.com/docs/reference/cli/supabase-login).

현재 연결 환경에서는 다시 `link`하지 않는다. 새 checkout이나 `supabase/.temp/project-ref`가 없는 환경에서만 먼저 `projects list`의 project ref·이름·소유 조직을 승인 대상과 대조한다. 대조가 끝난 뒤 아래 link 블록을 별도로 실행한다.

```powershell
$muzikProjectRef = 'dtljjrvkfuotriivrdza'
& $muzikCli link --project-ref $muzikProjectRef --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Project link failed.' }
if ((Get-Content -Raw 'supabase/.temp/project-ref').Trim() -ne $muzikProjectRef) {
    throw 'Linked project does not match the approved target.'
}
```

## 읽기 전용 재확인

이미 적용된 migration을 다시 밀지 않고 먼저 현재 상태를 확인한다.

```powershell
$muzikProjectRef = 'dtljjrvkfuotriivrdza'
if ((Get-Content -Raw 'supabase/.temp/project-ref').Trim() -ne $muzikProjectRef) {
    throw 'Linked project does not match the approved target.'
}
& $muzikCli migration list --linked --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Migration lookup failed.' }
& $muzikCli db push --linked --dry-run --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Migration dry-run failed.' }
& $muzikCli functions list --project-ref $muzikProjectRef --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Function lookup failed.' }
```

네 migration 버전이 양쪽에서 일치하고 dry-run에 pending 항목이 없어야 한다. 불일치하면 `migration repair`, `--include-all`, `db reset`, 반복 push를 사용하지 않고 실제 이력을 보고한다.

## 다시 적용해야 하는 경우

새 migration이나 승인된 Edge 변경이 생긴 경우에만 대상을 확인하고 아래 읽기 전용 dry-run 블록만 먼저 실행한다.

```powershell
& $muzikCli db push --linked --dry-run --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Migration dry-run failed.' }
```

출력의 대상 ref와 pending migration을 검토한다. 이미 승인된 변경은 같은 승인 범위에서 아래 실제 적용 블록으로 진행하며 별도 사용자 재승인을 요구하지 않는다. dry-run 검토가 끝나기 전에는 이 블록을 실행하지 않는다.

```powershell
& $muzikCli db push --linked --profile supabase --agent no --yes
if ($LASTEXITCODE -ne 0) { throw 'Migration apply failed.' }
& $muzikCli migration list --linked --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Migration verification failed.' }
& $muzikCli functions deploy muzik --project-ref $muzikProjectRef --profile supabase --agent no --use-api
if ($LASTEXITCODE -ne 0) { throw 'Function deploy failed.' }
& $muzikCli functions list --project-ref $muzikProjectRef --profile supabase --agent no
if ($LASTEXITCODE -ne 0) { throw 'Function verification failed.' }
```

`--use-api`는 서버에서 bundle하여 로컬 Docker를 요구하지 않는다. `--prune`, `--no-verify-jwt`를 쓰지 않는다. 로컬 `supabase/config.toml`의 localhost Auth 설정을 원격에 올리는 `config push`도 실행하지 않는다. YouTube key와 OAuth secret은 웹 번들에 넣지 않는다.

## 남은 실제 검증

Google provider의 client 설정과 실제 로그인 복귀, 두 승인 계정의 초대·재참여·곡 CRUD·권한, 실제 YouTube 공개/제한 영상, iOS/Android 설치와 재실행, production URL의 build/SW/직접 주소/rollback을 별도로 검증한다. 운영 fixture·가짜 사용자·가짜 곡을 만들어 연결 성공을 대체하지 않는다.
