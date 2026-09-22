# 외부 연결 현황과 남은 절차

승인된 Supabase 프로젝트에는 DB migration 네 개와 `muzik` Edge Function이 적용됐다. 익명 REST/RLS, private schema 비노출, Edge 인증 거부와 허용 origin CORS도 읽기 전용으로 확인했다. 아래 절차 중 Google/YouTube, 실제 두 계정·기기, Vercel production 배포 검증은 남아 있다.

최종 명령과 설정 대조/원복/병합 보류 조건은 [릴리즈 실행 순서](pwa-release.md), 구현별 검사 범위는 [검증 대조표](pwa-acceptance.md)를 참고합니다. 실제 Vercel 빌드는 `build:vercel`이 시스템 커밋 SHA와 production/preview 대상을 검증합니다.

1. 승인된 MUZIK Supabase 계정·프로젝트 `dtljjrvkfuotriivrdza`를 확인했고, 기존 다른 서비스 프로젝트를 재사용하지 않았다. 새 결제나 리소스 삭제는 하지 않았다.
2. [CLI 적용 절차](pwa-supabase-deploy.md)에 따라 migration 네 개를 적용하고 이력 일치와 Edge ACTIVE/version 1/`verify_jwt=true`를 확인했다. 이후에는 새 변경이 있을 때만 dry-run 뒤 적용한다.
3. Supabase Auth에 Google provider를 설정합니다. Google OAuth redirect는 해당 프로젝트의 Auth callback, Supabase 허용 redirect는 실제 웹 `/auth/callback`으로 제한합니다. 익명 가입은 사용하지 않습니다.
4. `WEB_ORIGINS=https://muzik-pwa.vercel.app`과 `muzik` 배포는 완료됐다. 서버 전용 YouTube key의 실제 검색/재생 결과는 아직 검증하지 않았다. service role/YouTube 키는 웹에 넣지 않는다.
5. 새 `muzik-pwa` 프로젝트의 Production 공개 환경과 고정 주소는 준비됐지만 실제 production deployment는 아직 없다. Production Branch=`main`, Ignored Build Step=`Only build production`을 유지한다. 기존 `dist`는 Production Branch=`demo/spark-web`와 같은 Ignored Build Step으로 격리했고 현재 배포·주소·환경변수는 유지했다.
6. 두 개 실제 Google 계정으로 생성→초대→재참여→등록→수정→삭제→로그아웃을 확인합니다. 재참여로 닉네임이 덮어써지지 않아야 합니다. 비회원의 읽기·직접 쓰기를 거절하는지 확인합니다.
7. 실제 YouTube 공개/비공개/임베드 제한/삭제/지역 제한 영상을 검사합니다. 테스트 fixture 성공을 이 결과로 대체하지 않습니다.
8. iOS Safari·Android Chrome·카카오 인앱에서 로그인 복귀, 날짜 전환, 키보드, 재연결을 검사합니다. 설치→완전 종료→재실행→동일 계정 복원, 오프라인 cold reopen, 편집/저장 중 새 버전 대기와 사용자 선택 적용, 실제 YouTube 재생도 각각 기록합니다. 자동화 설치 이벤트/표시 모드 fixture는 실제 설치가 아닙니다.

## 배포 가드

- 테스트 entrypoint는 `tests/fixtures/edge.ts`이며 운영 함수와 별개입니다. CI는 격리된 로컬 Supabase만 실행합니다. 운영은 `supabase/functions/muzik/index.ts`만 배포합니다.
- 운영 번들에 tests/examples/legacy import가 있거나 VITE 비밀 키가 있으면 빌드를 실패시킵니다.
- Supabase backend 적용 완료와 사용자 기능 검증 완료를 구분한다. 실제 Google 로그인·저장·음악 재생은 아직 제공 완료로 표시하지 않는다.
- 기존 공개 Vercel Expo 목업의 Production Branch만 `demo/spark-web`로 바꾸고 Ignored Build Step 저장을 확인했다. 현재 원격 `demo/spark-web` HEAD `af763f3`과 실제 배포 SHA `c13b952`가 다르므로 현재 배포·주소·환경변수를 유지하고 임의 redeploy하지 않는다. 신규 `muzik-pwa`의 root/build/output/env/domain은 main 반영 전 다시 대조한다.
- 이 저장소는 PUBLIC으로 확인했습니다. Vercel의 Hobby 제한은 비공개 조직 저장소 배포에 적용되며 공개 저장소는 별도로 구분합니다. 조직 소유만으로 유료 전환이 필수인 것은 아닙니다. Git 연결 권한과 Hobby의 개인·비상업 조건은 따로 확인합니다. [공식 Git 정책](https://vercel.com/docs/git#deploying-private-git-repositories).
- 배포 실패 시 호환되는 이전 Vercel production deployment로 복구하고 스키마는 데이터 삭제 없이 전진 수정합니다. 운영 권한 부여/회수, 신고·피드백 처리, 호출량 조정과 롤백 절차는 [운영 복구 지침](pwa-operations.md)을 따릅니다. Supabase backend 적용 이후 이번 확인은 읽기 전용이었고 운영 데이터는 만들거나 변경하지 않았습니다.
