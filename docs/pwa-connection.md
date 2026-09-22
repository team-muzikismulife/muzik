# 마지막 외부 연결 절차

이 문서는 준비 절차입니다. 실제 계정/프로젝트 생성·연결, OAuth 검증, 배포 성공 기록이 아닙니다.

최종 명령과 설정 대조/원복/병합 보류 조건은 [릴리즈 실행 순서](pwa-release.md), 구현별 검사 범위는 [검증 대조표](pwa-acceptance.md)를 참고합니다. 실제 Vercel 빌드는 `build:vercel`이 시스템 커밋 SHA와 production/preview 대상을 검증합니다.

1. 사용자가 지정한 Supabase 계정과 소유 조직의 무료 프로젝트 한도를 확인합니다. 기존 다른 서비스 계정·프로젝트를 재사용하지 않습니다. 새 결제나 리소스 삭제는 하지 않습니다.
2. 승인된 MUZIK 프로젝트에 [CLI 적용 절차](pwa-supabase-deploy.md)로 `supabase/migrations`를 적용합니다. 프로젝트와 기존 스키마를 먼저 확인하며 운영 데이터 자동 이전은 없습니다.
3. Supabase Auth에 Google provider를 설정합니다. Google OAuth redirect는 해당 프로젝트의 Auth callback, Supabase 허용 redirect는 실제 웹 `/auth/callback`으로 제한합니다. 익명 가입은 사용하지 않습니다.
4. 서버 전용 `YOUTUBE_API_KEY`, `WEB_ORIGINS`를 Edge secrets로 설정하고 `muzik` 함수를 배포합니다. service role/YouTube 키는 웹에 넣지 않습니다. WEB_ORIGINS는 허용한 HTTPS origin 목록입니다.
5. Vercel Production 환경에는 `VITE_SUPABASE_URL`, 공개 `VITE_SUPABASE_ANON_KEY`, 고정 HTTPS origin `VITE_PUBLIC_ORIGIN`만 설정합니다. `VITE_APP_VERSION`은 Vercel Git SHA에서 생성합니다. 프로젝트 루트는 저장소 루트, Production Branch는 `main`, Ignored Build Step은 `Only build production`으로 대조합니다. 현재 origin이 고정 주소와 다르거나 Preview이면 설치 요청·운영 지표를 차단합니다.
6. 두 개 실제 Google 계정으로 생성→초대→재참여→등록→수정→삭제→로그아웃을 확인합니다. 재참여로 닉네임이 덮어써지지 않아야 합니다. 비회원의 읽기·직접 쓰기를 거절하는지 확인합니다.
7. 실제 YouTube 공개/비공개/임베드 제한/삭제/지역 제한 영상을 검사합니다. 테스트 fixture 성공을 이 결과로 대체하지 않습니다.
8. iOS Safari·Android Chrome·카카오 인앱에서 로그인 복귀, 날짜 전환, 키보드, 재연결을 검사합니다. 설치→완전 종료→재실행→동일 계정 복원, 오프라인 cold reopen, 편집/저장 중 새 버전 대기와 사용자 선택 적용, 실제 YouTube 재생도 각각 기록합니다. 자동화 설치 이벤트/표시 모드 fixture는 실제 설치가 아닙니다.

## 배포 가드

- 테스트 entrypoint는 `tests/fixtures/edge.ts`이며 운영 함수와 별개입니다. CI는 격리된 로컬 Supabase만 실행합니다. 운영은 `supabase/functions/muzik/index.ts`만 배포합니다.
- 운영 번들에 tests/examples/legacy import가 있거나 VITE 비밀 키가 있으면 빌드를 실패시킵니다.
- 실제 외부 연결 전에는 사용자 음악 저장·로그인 제공이 완료되었다고 표시하지 않습니다.
- 기존 공개 Vercel Expo 목업과 프로젝트 설정은 변경하지 않았습니다. main 병합 전에 소유자·용도·Git 연결·root/build/output/production branch/ignored build/환경변수/도메인을 확인합니다.
- 이 저장소는 PUBLIC으로 확인했습니다. Vercel의 Hobby 제한은 비공개 조직 저장소 배포에 적용되며 공개 저장소는 별도로 구분합니다. 조직 소유만으로 유료 전환이 필수인 것은 아닙니다. Git 연결 권한과 Hobby의 개인·비상업 조건은 따로 확인합니다. [공식 Git 정책](https://vercel.com/docs/git#deploying-private-git-repositories).
- 배포 실패 시 호환되는 이전 Vercel production deployment로 복구하고 스키마는 데이터 삭제 없이 전진 수정합니다. 운영 권한 부여/회수, 신고·피드백 처리, 호출량 조정과 롤백 절차는 [운영 복구 지침](pwa-operations.md)을 따릅니다. 이 단계에서 실제 프로젝트를 조작한 것은 아닙니다.
