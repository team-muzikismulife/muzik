# 모바일 웹 베타 구현 계획

## 제품 목표 갱신 (2026-09-21)
- 사용자 최신 결정: 발표/목업 제공이 아니라 실제 사용자가 지속해서 쓸 수 있는 모바일 웹 서비스가 목표다.
- 배포와 사용자 진입은 production 기준으로 검증한다. 목업과 에뮬레이터는 내부 회귀 테스트에만 유지하며, 운영 오류를 목업으로 대체하지 않는다.
- 우선순위는 실제 팀 생성/초대/참여, 곡 등록/수정/삭제와 상대 사용자 반영, 재방문 시 데이터 유지, 실패 시 입력 보존과 재시도, 신고 및 운영 대응이다.
- 실제 Firebase/YouTube 및 배포 URL에서 서로 다른 두 사용자로 검증하기 전에는 출시 완료로 표시하지 않는다. 브라우저 익명 계정은 기기간 복구를 보장하지 않으며 계정 복구는 별도 제품 결정 사항이다.
- 이번 재검사: npm run check:production은 EXPO_PUBLIC_RECAPTCHA_SITE_KEY 누락으로 실패. 기존 요금제/로그인 상태 기록은 외부 작업 직전 다시 확인하며 결제 변경이나 공개 배포를 자동 실행하지 않는다.

## MUZIK-BETA-02 (2026-09-21)
1. 저장된 요청 결과를 영상 API 호출보다 먼저 조회한다. UID/작업/requestId와 입력 digest를 확인하고 기존 성공 응답만 재생한다. 새 요청은 멤버십/요청 제한/영상 검증과 커밋 시 트랜잭션 재검사를 유지한다.
2. 에뮬레이터 전용 영상 실패 제어로 등록/수정 성공 후 외부 장애, 같은 ID 입력 변경, 새 ID 오류 및 집계/이벤트 중복 없음을 검사한다.
3. origin/dev의 기존 팀 작업과 현재 변경을 비교해 별도 codex/ worktree에서 파일별 통합한다. 원래 checkout의 미커밋 파일은 유지한다. 베타에 필요한 파일만 명시적으로 stage하고 dev 대상 draft PR을 만든다.
4. Node22 실제 CI 및 관련 브라우저 회귀를 확인한다. 배포 문서를 단일 순서로 정리하고 PR/CI 링크와 제외 파일 관계를 보고서에 남긴다. main merge/운영 배포/결제 변경은 범위 밖이다.

2026-09-21. 기존 demo/spark-web 및 미커밋 UI 작업을 보존한다. 총괄 소유 launch-control.md, beta-promotion.md는 수정하지 않는다.

## 단계
1. 완료: demo / emulator / production 명시 분리, 운영 설정 사전 검사, export 실패 즉시 중단.
2. 완료: callable 서버 쓰기: 팀 생성/참여, 곡 등록/수정/삭제/메타 갱신. 서버 KST 날짜와 UID, 멤버십, 정원, 멱등 요청, 원자적 집계.
3. 완료: 신고/개인 숨김/운영 검토, 피드백, 최소 이벤트. 운영자는 Firebase custom claim admin=true로만 검증. 실제 운영자 지정은 미실행.
4. 완료: 베타 UX 연결, 공유 즐겨찾기 등 미완성 경로 차단. 브라우저 익명 계정 복원 범위 안내.
5. 로컬 검증 완료: 타입/빌드, emulator 회귀27개, 독립 브라우저2개, 데모 정적 번들. 운영 배포는 결제 미연결/Vercel 재로그인/App Check 설정 누락으로 미실행. 자세한 근거는 launch-worker-report.md.

## 보안 및 데이터 계약
- 운영/에뮬레이터 클라이언트는 Firestore 읽기 전용. 초대 조회도 callable 경유.
- demo는 로컬 고정 데이터만 사용하며 실 Firebase 자격 증명을 무시한다. __DEV__ 자체는 모드를 바꾸지 않는다.
- 요청 ID는 클라이언트가 재시도 동안 보존. 서버는 UID+작업+요청 ID와 입력 해시를 기록해 중복 실행/다른 입력 재사용을 차단한다.
- 곡 날짜/소유권/메타는 서버가 확정. 등록/수정/삭제와 days 집계는 같은 트랜잭션. 팀당 하루 각 UID 1곡.
- 운영 숨김은 공개 tracks 문서의 내용을 제거하고 서버 전용 moderationArchive에 보존한다. 해당 UID의 당일 슬롯은 유지, days는 표시 가능한 곡만 집계. 개인 숨김은 해당 브라우저에만 저장하며 공동 집계에 영향 없음.
- 신고/피드백 원문은 운영자만 callable로 열람. 이벤트는 방문/팀생성/팀참여/첫등록/익일등록만, 닉네임·코멘트·영상 URL 미수집.
- 익명 UID별 호출 제한과 가입/생성 IP 해시 제한, 운영 App Check, maxInstances/minInstances 제한. 예산 알림은 비용 상한이 아님을 운영 문서에 명시.

## 검증 및 출시 판정
실 Firebase 연결, 서버 배포, 두 사용자 종단검증 완료 전 운영 준비 완료로 표시하지 않는다. 에뮬레이터의 영상 fixture는 실제 YouTube 검증과 구별한다. 모바일 Safari/카카오 인앱 실기기 검증은 별도 필요하다.

공식 근거: https://firebase.google.com/docs/functions/callable , https://firebase.google.com/docs/app-check/cloud-functions , https://firebase.google.com/docs/functions/manage-functions , https://developers.google.com/youtube/v3/docs/videos/list
