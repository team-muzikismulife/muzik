# MUZIK PWA

운영 앱은 apps/web, 순수 계약은 packages/domain, 서버는 supabase. 테스트는 tests/{unit,integration,e2e,fixtures}. 구 Expo/Firebase/네이티브는 legacy에 보존하고 시연 데이터는 examples/mock에 격리한다.

- 현재 서비스는 외부 계정 연결 전이다. 설정이 없는 공개 화면은 정상 부팅하지만 로그인/저장 성공을 흉내 내지 않는다.
- 운영 코드는 legacy/examples/tests를 import하지 않는다. 비밀키는 서버만, 사용자 쓰기는 Edge 경유, 내부 RPC는 service_role만 실행한다.
- 모든 변경은 타입·빌드·권한/동시성·번들 분리 검사 후 PR로 올린다. 실제 OAuth/YouTube와 fixture 검사 결과를 구분한다.
- 기존 소스·운영 데이터는 보존하고 새 계정 연결은 사용자 준비 통보 후 진행한다.
- 새 PWA 구현 기준은 docs/pwa-implementation.md와 docs/pwa-connection.md. 과거 RN 전용 문서는 docs/archive에 있다.
