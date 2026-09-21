# PWA 운영과 복구

이 문서는 연결 전 준비입니다. 실제 외부 계정·프로젝트·사용량·실기기 설치 검증은 하지 않았습니다. 정식 연결 이후 지정한 MUZIK 프로젝트만 대상으로 확인합니다.

## 운영 권한

신뢰된 프로젝트 관리자가 Auth에서 검증한 사용자 UUID를 `private.operators`에 등록합니다. 이메일이나 사용자가 수정할 수 있는 `user_metadata`를 권한 근거로 사용하지 않습니다. 브라우저에는 권한 부여 API가 없습니다.

```sql
-- 실제 사용자를 별도로 검증한 뒤, 신뢰된 SQL 관리 세션에서만 실행합니다.
insert into private.operators(user_id) values ('<verified-auth-user-uuid>') on conflict do nothing;
-- 회수
delete from private.operators where user_id = '<verified-auth-user-uuid>';
```

로그인 후 서버 `getCapabilities`가 운영 권한을 확인한 계정만 운영 검토 메뉴를 봅니다. 실제 조회/처리 시마다 DB 권한을 다시 확인하고, 회수 뒤 과거 성공 요청을 재조회하는 것도 차단합니다. 메뉴의 캐시된 표시가 API 권한을 주지는 않습니다.

## 신고와 피드백

- 신고는 추천 UUID별로 원문 스냅샷을 비공개 접수하며 같은 신고자/추천 중복을 방지합니다. 운영 목록은 먼저 접수된 미처리50건이며 처리 후 다음 건이 나타납니다.
- 운영자는 처리 메모를 남기고 숨김 또는 숨김 없이 종결합니다. 숨김은 같은 트랜잭션에서 원문 archive 보관, 공개 제목/영상/채널/이유 비우기, 날짜 집계·표지 갱신을 수행합니다. 최초 주제는 유지합니다. 당일 한 곡 슬롯은 남아 일반 수정·삭제·재등록이 차단됩니다.
- 삭제/재등록으로 다른 추천이 생기면 신고의 옛 UUID를 처리하며 새 추천을 숨기지 않습니다. 이미 사라진 원문도 신고 당시 비공개 스냅샷으로 검토합니다.
- 피드백은 팀원만 보낼 수 있습니다. 사용자·팀별 입력과 전송 ID/payload를 기기에 보관하며 실패/재실행 뒤 같은 요청을 확인합니다. 자동 재전송하지 않습니다. 명시적 로그아웃은 해당 로컬 내용을 지웁니다.
- 현재 곡 메타데이터 갱신 API는 멤버 또는 운영자만 이용합니다. 운영 검토 화면에서만 별도 진입을 제공합니다. YouTube API 검색은 하지 않고 영상 ID로 조회하며, 일반 캐시는1일, 명시 갱신은 최근5분 캐시를 재사용합니다. 성공 요청을 재시도하면 YouTube 장애에도 기존 성공 결과를 반환합니다.
- 기본 시간당 제한: 피드백5회, 메타 갱신10회, 신고20회, 계측12회. 다른 기존 제한은 유지합니다. 한도 변경은 검토된 migration으로 하고 클라이언트에서 우회하지 않습니다.

## 최소 지표와 사용량

`private.daily_events`는 기존 사용자 UUID/서버 KST 날짜/종류만 보관합니다. 일 방문, 설치 안내 진입, 브라우저 설치 요청 수락, standalone 표시 모드 실행은 별개이며 종류마다 하루 한 건입니다. 익명 식별자·외부 분석·기기 추적 ID를 만들지 않습니다. 자동 계측은 고정 HTTPS origin에서 로그인한 경우에만 시도하고 실패를 핵심 행동에 전파하거나 무한 재시도하지 않습니다. 따라서 수집된 최소 기록이지 모든 방문을 보장하는 지표는 아닙니다. 수락 또는 standalone 실행을 설치 성공/설치 기기 수로 표시하지 않습니다.

운영 화면은 현재 Supabase 프로젝트 콘솔과 [공식 조직 사용량](https://supabase.com/dashboard/org/_/usage)을 제공합니다. 조직 사용량에서 해당 프로젝트를 선택해 DB, Auth, Realtime, Edge, egress 등을 확인합니다. 앱에서 측정하지 않은 사용량·잔여 한도·동시 청취 수를 계산하지 않습니다. 공식 설명: [사용량 집계 범위](https://supabase.com/docs/guides/troubleshooting/understanding-the-usage-summary-on-the-dashboard-D7Gnle).

한도가 가까우면 모집을 줄이고 Realtime 구독/불필요 조회/메타 갱신 빈도를 먼저 점검합니다. 자동 유료 전환, 카드 등록, 인위적인 keep-alive는 하지 않습니다. 무료 프로젝트의 저활동 일시정지 가능성과 복구 조건은 [Supabase 공식 안내](https://supabase.com/docs/guides/platform/free-project-pausing)를 확인합니다. Dashboard에서 상태를 확인·복구한 뒤 실제 두 계정 로그인/팀 조회/곡 등록/신고를 재검증합니다.

## 업데이트와 롤백

1. 매 배포에 `VITE_APP_VERSION`으로 커밋을 기록하고 직전 정상 정적 산출물·환경 설정·manifest를 보존합니다. 같은 고정 origin과 manifest `id/start_url/scope`를 유지합니다.
2. worker는 새 파일을 준비하되 자동으로 페이지를 새로고침하지 않습니다. 저장 중이거나 보관되지 않은 입력이 있으면 적용을 막습니다. 초안과 미확정 요청은 전송 전에 보관하므로 완료 후 사용자가 적용해도 같은 ID/payload로 복구합니다. ‘나중에’는 현재 화면을 유지합니다.
3. 업데이트 알림은 일반 문서 흐름에 있으므로 입력·완료 버튼 위에 떠 있지 않습니다. 다른 탭이 worker를 활성화해도 이 탭은 사용자 동의 없이 새로고침하지 않습니다. 구버전 동적 파일을 가져오지 못하면 경계 오류의 재시도/새로고침으로 복구하며 초안은 보존됩니다.
4. 정적 HTML/JS/CSS/아이콘/폰트만 precache합니다. 인증 callback, 서버 응답, 팀 자료, YouTube 영상은 캐시하지 않습니다. 새 worker 활성화 시 이전 precache 항목을 정리합니다. 로컬 초안과 인증 SDK 저장소는 SW 캐시와 별개입니다.
5. 문제 배포는 Cloudflare의 같은 서비스/주소에서 직전 정상 버전으로 rollback합니다. [공식 rollback 절차](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)를 따르며 assets와 배포 버전의 결합 및 외부 리소스 변경 제약을 확인합니다. 프로젝트 연결/권한은 마지막 연결 단계에서 검증합니다.
6. 이전 웹 버전이 현재 DB/Edge 계약 및 초안 version1과 호환되는지 먼저 확인합니다. DB schema/데이터 삭제나 Firebase 자동 전환은 롤백 수단으로 쓰지 않습니다. 연결되기 전 작성한 이 절차는 실제 Cloudflare rollback 완료 기록이 아닙니다.
7. 고정 주소에서 worker update를 확인하고 사용자가 이전 정상 버전 적용을 선택한 뒤 버전 식별자·기존 초안·미확정 요청 재확인·로그인·팀·재생을 확인합니다. 캐시 전체/로컬 저장소 삭제를 기본 복구책으로 안내하지 않습니다.

## 검증 구분

CI는 로컬 HTTPS에서 실제 generateSW 두 버전을 제공하여 대기/선택 적용/이전 캐시 정리/이전 버전 재적용을 검사합니다. 실제 Supabase 로컬 DB/Auth/Edge/RLS와 분리된 테스트 OAuth claim·YouTube 응답을 사용합니다. 브라우저 설치 이벤트와 standalone 표시 모드 fixture는 Android/iPhone 실제 설치·앱 종료 후 복원·실제 Google/YouTube·Cloudflare 배포 검증을 대체하지 않습니다.

설치 안내 구현 참고: [MDN beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event), [Apple 홈 화면 웹 앱](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios), [Vite PWA 명시 업데이트와 캐시 정리](https://vite-pwa-org.netlify.app/guide/prompt-for-update).
