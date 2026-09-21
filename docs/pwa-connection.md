# 마지막 외부 연결 절차

이 문서는 준비 절차입니다. 실제 계정/프로젝트 생성·연결, OAuth 검증, 배포 성공 기록이 아닙니다.

1. 사용자가 지정한 Supabase 계정과 소유 조직의 무료 프로젝트 한도를 확인합니다. 기존 다른 서비스 계정·프로젝트를 재사용하지 않습니다. 새 결제나 리소스 삭제는 하지 않습니다.
2. 새 MUZIK 프로젝트를 만들고 `supabase/migrations`를 적용합니다. 운영 데이터 자동 이전은 없습니다.
3. Supabase Auth에 Google provider를 설정합니다. Google OAuth redirect는 해당 프로젝트의 Auth callback, Supabase 허용 redirect는 실제 웹 `/auth/callback`으로 제한합니다. 익명 가입은 사용하지 않습니다.
4. 서버 전용 `YOUTUBE_API_KEY`, `WEB_ORIGINS`를 Edge secrets로 설정하고 `muzik` 함수를 배포합니다. service role/YouTube 키는 웹에 넣지 않습니다. WEB_ORIGINS는 허용한 HTTPS origin 목록입니다.
5. `apps/web` 빌드 환경에는 `VITE_SUPABASE_URL`, 공개 `VITE_SUPABASE_ANON_KEY`만 설정합니다. build와 deploy:check 후 Cloudflare Workers assets 배포를 연결합니다. 예시 이름을 운영 계정에서 확인하고 실제 호스트를 redirect/origin 설정에 맞춥니다.
6. 두 개 실제 Google 계정으로 생성→초대→재참여→등록→수정→삭제→로그아웃을 확인합니다. 재참여로 닉네임이 덮어써지지 않아야 합니다. 비회원의 읽기·직접 쓰기를 거절하는지 확인합니다.
7. 실제 YouTube 공개/비공개/임베드 제한/삭제/지역 제한 영상을 검사합니다. 테스트 fixture 성공을 이 결과로 대체하지 않습니다.
8. iOS Safari·Android Chrome·카카오 인앱에서 로그인 복귀, 날짜 전환, 키보드, 재연결을 검사합니다. PWA 설치·업데이트·재생 상세 검증은 PWA-02 기능 완성 후 수행합니다.

## 배포 가드

- 테스트 entrypoint는 `tests/fixtures/edge.ts`이며 운영 함수와 별개입니다. CI는 격리된 로컬 Supabase만 실행합니다. 운영은 `supabase/functions/muzik/index.ts`만 배포합니다.
- 운영 번들에 tests/examples/legacy import가 있거나 VITE 비밀 키가 있으면 빌드를 실패시킵니다.
- 실제 외부 연결 전에는 사용자 음악 저장·로그인 제공이 완료되었다고 표시하지 않습니다.
- 과거 Vercel 연결은 아직 변경하지 않았습니다. main 병합 전에 프로젝트의 root/build/production branch 및 자동 배포 영향을 확인합니다.
- 배포 실패 시 이전 Cloudflare 배포로 복구하고 스키마는 데이터 삭제 없이 전진 수정합니다. 기능별 비상 비활성화와 운영자 신고 처리 절차는 후속 구현 범위입니다.
