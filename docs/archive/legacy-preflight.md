# 기존 Spark 데이터 사전검사

2026-09-21. 실제 운영 DB는 조회하거나 수정하지 않았다. 근거는 c13b952의 `src/lib/api.ts` 직접쓰기 코드, 최신 demo PR39 및 현재 Functions/Rules 계약이다.

## 검사 실행

`scripts/legacy-preflight.mjs`는 조회만 한다. 쓰기/복구 옵션, 전체 rooms 열거, 기본 운영 프로젝트가 없다.

```powershell
# 이미 승인된 로컬 스냅샷만 검사 (네트워크 없음)
node scripts/legacy-preflight.mjs --input scratch/approved-room-snapshot.json

# 내부 fixture 검사: 지정한 팀 하나만 읽는다
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
node scripts/legacy-preflight.mjs --project demo-muzik --room <roomId>
```

운영 조회는 별도 승인과 읽기 전용 IAM 자격증명 확보 후에만 `--project <실제ID> --room <명시ID> --allow-live-read`로 실행한다. 이번 작업에서는 실행하지 않았다. 에뮬레이터 환경변수와 live 프로젝트 혼용은 거부한다. ADC에 쓰기 권한이 있더라도 이 스크립트는 get/where/limit만 호출한다. IAM 자체 읽기 전용이 추가 방어다.

각 members/tracks/days/progress 및 해당 팀 moderationArchive에 limit(1001)을 적용한다. 1000개 초과 시 SCAN_TRUNCATED로 준비 판정을 거부하며, 모든 데이터가 검증됐다고 표시하지 않는다. 최소 방 문서/초대 역참조와 5개 제한 쿼리만 사용한다. 실행 중 동시 쓰기를 배제하는 원자적 전체 스냅샷은 아니므로 실제 점검은 쓰기 중지 상태에서 재실행해야 한다.

출력은 경고 코드·문서 경로·개수이며 닉네임/코멘트/영상 원문을 담지 않는다. 문서 ID도 사용자 식별자일 수 있으므로 보고서/스냅샷은 비공개로 보관하고 저장소에 커밋하지 않는다. 종료코드 0은 스키마 blocker 없음, 2는 blocker 존재, 1은 조회/입력 오류다. `ready: true`여도 warning 검토와 실제 서비스 검증 전 출시 승인으로 해석하면 안 된다.

입력 JSON은 `{roomId, room, invite, members:[{id,data}], tracks:[{id,data}], days:[{id,data}], progress:[{id,data}], archives:[{id,data}], truncated}` 구조다. UID별 Auth 계정 존재 여부, 모든 외부 invite 문서, 다른 방, 삭제된 기록은 이 검사 범위 밖이다.

## 차이와 복구 원칙

| 발견 항목 | 신규 코드 영향 | 승인 후 복구 계획 (이번에는 미실행) |
|---|---|---|
| memberCount 불일치/누락 | 정원 우회 또는 잘못된 가입 거부, 팀 카드 표시 오류 | 쓰기 중지·백업 후 실제 members 개수와 UID 중복/위조 확인. 검증된 개수만 Admin 트랜잭션으로 보정하고 재검사 |
| members.uid/id 불일치, nickname/joinedAt 누락 | 참여팀 collectionGroup 복원 실패, 등록 메타 오류, orderBy에서 팀원 누락 | Auth/초대 기록과 소유권 확인 후 복구. 문서 ID만 보고 다른 사용자로 합치지 않음 |
| tracks ID/uid/dateKey/order/createdAt 오류 | 하루 슬롯 충돌, query/orderBy에서 누락, 집계 손상 | 원본 백업·당시 클라이언트/서버 기록 대조. 기존 정상 날짜·순서·생성시각은 이동/재계산하지 않음 |
| Spark durationSec=0, embeddable=true 및 최근 metaRefreshedAt | 실제 videos.list 검증 증거가 아님. 현재 refreshMeta는 30일 캐시를 존중하므로 즉시 검증이 보장되지 않음 | 출시 전에 영상 ID를 서버 API로 검증할 별도 승인된 작업 필요. 원문 메타/시각 백업 후 캐시만 갱신. 이번 검사에서 YouTube 호출/시간값 강제 변경 없음 |
| days 누락/개수·cover 불일치 | 과거 날짜 탭 누락, 대표 이미지 잘못 표시 | visible tracks의 실제 순서 기준으로 집계만 재작성. hidden은 제외. 무조건 전체 DB 덮어쓰기 금지 |
| themeText 누락 | 현 내장 풀 fallback이 당시 미션과 다를 수 있음 | 당시 배포 코드/백업으로 입증될 때만 복구. 근거가 없으면 운영자가 누락 처리 UX를 결정할 때까지 blocker, 현재 themeFor로 역사 조작 금지 |
| hidden 원문/추가 필드 잔존, archive 없음 | 읽기 권한이 있는 사용자에게 숨긴 원문 노출 또는 복구 원문 없음 | 비공개 archive 보존 여부 확인 후 공개 문서는 허용 필드 tombstone으로 교체. 이번 신규 moderateTrack는 알 수 없는 과거 추가 필드도 archive에만 보관 |
| progress 없음 | 기존 사용자의 전환 후 첫 등록이 새 first_registered로 집계될 수 있음 | 측정 cohort를 전환 이후로 한정하거나 증거가 있는 earliest date만 승인 후 보정. 과거 이벤트를 가짜 생성하지 않음 |
| 옛 4시 기준 날짜, 탈퇴 멤버 곡 | 당일 편집 가능성/표시 이름 해석 차이 | 기존 dateKey 유지. 새 등록만 KST 자정 계약. 탈퇴자 닉네임 스냅샷 보존, Auth 복구·계정 병합은 범위 밖 |

정상 Spark 스키마는 현재 members/tracks/days 읽기와 호환된다. 이미 존재하는 과거 곡을 일괄 rewrite하지 않는다. 사용자 당일 수정은 요청한 곡/메타 변경이며 UID·날짜·순서·생성시각과 서버에 있던 미션 스냅샷을 유지한다. 과거 직접쓰기 권한으로 남은 위조 데이터 가능성은 스키마 검사만으로 신뢰할 수 없다. 실제 자료/권한 검토가 별도 출시 조건이다.

## 검증

`node scripts/test-legacy.mjs`: Node22 에뮬레이터 6개 PASS. 운영 연결 차단, 읽기 전후 동일, 오류 fixture 탐지, 기존 읽기/재입장/신규가입/중복등록 거부, 당일 수정의 과거 보존, 과거 신고의 원문 비공개 보존/공개 추가필드 제거/집계 제외를 확인한다. CI에도 같은 검사를 추가했다. 테스트 fixture 생성은 이 테스트 파일에만 있으며 사전검사 파일에는 없다.
