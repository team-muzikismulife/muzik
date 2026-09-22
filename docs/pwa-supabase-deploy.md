# Supabase CLI 적용 절차

이 문서는 CLI 2.117.0의 도움말과 공식 소스를 확인한 실행 지침이다. 원격 로그인, DB 적용, Edge 배포 성공 기록은 아니다. 승인된 release worktree의 저장소 루트에서 실행한다. 브라우저 담당자와 적용 시점을 조율한다.

## 자격과 대상

| 항목 | 사용 위치 |
| --- | --- |
| 승인된 계정의 Personal Access Token | 현재 터미널의 `SUPABASE_ACCESS_TOKEN`, Management API 인증 |
| 대상 프로젝트 DB 비밀번호 | 현재 터미널의 `SUPABASE_DB_PASSWORD`, migration DB 연결 |
| Project ref | 승인된 대상 ID. 비밀값은 아니며 모든 명령에서 대조 |
| YouTube Data API Key | Supabase Edge secret `YOUTUBE_API_KEY` |
| 고정 production HTTPS origin | Edge `WEB_ORIGINS`, Vercel `VITE_PUBLIC_ORIGIN`, Supabase Auth redirect |
| Google OAuth Client ID/Secret | Supabase Google provider. DB migration 자체에는 필요하지 않음 |
| Supabase 공개 URL/anon 또는 publishable key | Vercel `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

브라우저 로그인은 CLI 인증을 제공하지 않는다. PAT는 DB 비밀번호나 anon/service role key와 다르다. Edge의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 호스팅 플랫폼이 제공하며 웹에 service role을 넣지 않는다.

## profile 오류와 인증

`--profile muzik-pwa`는 임의 계정 별칭을 만드는 옵션이 아니다. CLI는 내장 profile 이외의 값을 설정 파일 경로로 해석하며 확장자가 없으면 `LegacyProfileLoadError: Unsupported Config Type ""`로 API 요청 전에 실패한다. `--name`은 로그인 토큰 이름이며 계정 저장소 분리 옵션이 아니다. [2.117.0 profile loader](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-profile-load.ts).

이번 연결은 기존 자격을 보존하도록 영구 `login` 대신 공식 지원 환경변수 인증을 사용한다. 새 PowerShell 터미널에서 사용자가 아래 입력을 직접 실행한다. 토큰/비밀번호를 명령 인수, 채팅, transcript 또는 파일에 붙이지 않는다. 기존 `~/.supabase`와 OS 자격 저장소는 읽거나 지우지 않는다. [공식 CLI 인증](https://supabase.com/docs/reference/cli/supabase-login).

```powershell
$muzikPat = Read-Host 'New account Supabase PAT' -AsSecureString
$env:SUPABASE_ACCESS_TOKEN = [System.Net.NetworkCredential]::new('', $muzikPat).Password
$muzikPat.Dispose()
$muzikDbPassword = Read-Host 'Approved project DB password' -AsSecureString
$env:SUPABASE_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $muzikDbPassword).Password
$muzikDbPassword.Dispose()

$muzikCli = Join-Path (Get-Location) 'apps/web/node_modules/.bin/supabase.cmd'
function Invoke-MuzikSupabase {
    if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
        throw 'Set the new account session token first; do not fall back to saved credentials.'
    }
    & $muzikCli @args --profile supabase
    if ($LASTEXITCODE -ne 0) { throw 'Supabase command failed. Stop before the next step.' }
}
Invoke-MuzikSupabase --version
Invoke-MuzikSupabase projects list
```

`--profile supabase`는 공식 production API endpoint 선택이며 이 명령들은 로그인 자격을 저장하지 않는다. 환경변수 토큰이 저장된 기본 토큰보다 우선한다. 출력의 프로젝트 ID·이름·조직·지역을 승인 대상과 대조한다. 승인 대상이 보이지 않으면 다른 계정으로 진행하지 않는다. CLI 로그인 성공은 실제 이 조회를 통과한 뒤에만 기록한다.

## migration 확인과 적용

```powershell
$muzikProjectRef = 'dtljjrvkfuotriivrdza'
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PASSWORD)) { throw 'DB password is required.' }
Invoke-MuzikSupabase link --project-ref $muzikProjectRef
if ((Get-Content -Raw 'supabase/.temp/project-ref').Trim() -ne $muzikProjectRef) {
    throw 'Linked project does not match the approved target.'
}
Invoke-MuzikSupabase migration list --linked
Invoke-MuzikSupabase db push --linked --dry-run
```

기대하는 파일은 아래 네 개다. 원격 migration history가 없더라도 스키마가 비어 있다는 뜻은 아니다. Table Editor/SQL 조회로 `public.rooms/members/tracks/days`와 `private`의 기존 객체도 확인한다. 초기 SQL의 `create table`은 기존 같은 이름의 테이블을 자동 통합하지 않는다. 불일치 시 `migration repair`, `--include-all`, `db reset`을 사용하지 않는다.

1. `202609210001_core.sql`
2. `202609210002_daily_flow.sql`
3. `202609210003_operations.sql`
4. `202609210004_install_metrics.sql`

총괄이 dry-run과 대상을 확인하고 적용 단계로 진행할 때 실행한다.

```powershell
Invoke-MuzikSupabase db push --linked
Invoke-MuzikSupabase migration list --linked
Invoke-MuzikSupabase db push --linked --dry-run
```

마지막 목록의 Local/Remote에 네 버전이 일치하고 dry-run에 pending migration이 없어야 한다. 적용 실패 시 다음 명령을 멈추고 실제 이력을 확인한다. 운영 데이터로 자동화 fixture 테스트를 실행하지 않는다.

## Edge와 연결 검증

브라우저 담당자가 대상 프로젝트의 Edge secrets에 `YOUTUBE_API_KEY`, 정확한 production origin인 `WEB_ORIGINS`를 등록한다. 여러 승인 origin이면 쉼표로 구분하고 wildcard를 쓰지 않는다. 비밀값을 CLI 인수로 노출하지 않도록 이번 절차에서는 Dashboard 입력을 사용한다.

```powershell
Invoke-MuzikSupabase functions deploy muzik --project-ref $muzikProjectRef --use-api
Invoke-MuzikSupabase functions list --project-ref $muzikProjectRef
```

`--use-api`는 서버에서 bundle하여 로컬 Docker를 요구하지 않는다. 함수 이름을 생략하지 않고 `--prune`, `--no-verify-jwt`를 사용하지 않는다. `supabase/config.toml`의 `functions.muzik.verify_jwt=true`와 handler의 `auth.getUser()` 검증을 유지한다. 로컬 config의 localhost Auth 설정을 원격에 올리는 `config push`도 이 절차에 포함하지 않는다.

Google provider에는 Google OAuth Client ID/Secret, Google 측 redirect에는 `https://<PROJECT_REF>.supabase.co/auth/v1/callback`을 설정한다. Supabase Site URL은 확정한 production origin, 허용 redirect는 해당 origin의 `/auth/callback`이다. 배포 뒤 미인증 요청 차단, 승인된 두 실제 Google 계정의 로그인/초대/등록/권한과 실제 YouTube 재생을 확인한다.

작업 종료 시 새 터미널을 닫거나 다음을 실행해 세션 자격을 제거한다. 자격값은 출력하지 않는다.

```powershell
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
```
