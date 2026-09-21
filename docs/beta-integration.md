# dev 기반 모바일 웹 베타 통합

2026-09-21. 기준 origin/dev b10f514, 브랜치 codex/mobile-web-beta.

## 변경 보존
- 원래 demo/spark-web c13b952 checkout은 이동/reset/stash하지 않았다. 기존 미커밋 변경은 그대로 유지했다.
- scratch/beta-integration 별도 worktree에서 베타에 필요한 소스/설정/테스트/문서 66개를 명시적으로 복사한 뒤 파일별 병합했다. 전체 디렉터리 동기화/삭제하지 않았다.
- dev의 useDateKey, missionFor, 날짜 상세 전용 store, 공동 플리 store, 웹/네이티브 YoutubePreview 및 기존 설계 문서를 보존했다.
- db의 dev 읽기 API를 보존하면서 베타 화면에 필요한 개별 구독을 추가했다. 홈은 useDateKey를 사용하고 오늘/과거 모두 서버 미션 스냅샷을 우선한다.
- 날짜별 상세는 신고/개인 숨김/메타 갱신/연결 상태를 갖춘 베타 room 구독을 사용한다. dev의 과거 1회 조회 API와 store는 후속 비용 최적화에 쓰도록 남겼다. 이는 의도적인 구독 정책 차이다.
- 공동 플리 dev 화면과 데이터 store는 삭제하지 않고 기본 라우트에서 홈으로 이동하도록 닫았다. 직접쓰기 공유폴더 기능은 이번 출시 대상이 아니다.
- 최신 origin/demo/spark-web af763f3(PR #39)과의 차이를 검토했다. 현재 멤버 이름 우선 표시와 Expo 캐시 초기화 빌드 수정은 반영했다. 데모 자동 진입/직접 DB 쓰기/공동폴더 노출은 미반영했다.
- .env/.env.local/.vercel 인증정보, node_modules, 생성된 dist/functions/lib, 스크린샷, 진단 스크립트, 총괄 소유 문서는 PR에 포함하지 않는다.

## 핵심 검증
- 등록/수정의 저장된 성공은 외부 YouTube 검증 전 조회한다. 동일 ID 입력 변경 거부, 멤버십 검증, 커밋 시 재검증은 유지한다.
- 외부 장애/영상 삭제/쿼터 초과 후 동일 ID 재시도 성공, 신규 ID 실패, 추가 API 호출/집계/이벤트 없음: 31개 에뮬레이터 검사에 포함.
- 로컬 타입/서버 빌드와 GitHub Node22 CI 결과는 실행 환경을 구분하여 launch-worker-report.md에 기록한다.
- Firebase 요금제/키 승인과 실제 배포는 별도다. main merge, rules 배포, Vercel 우회 배포를 하지 않는다.
