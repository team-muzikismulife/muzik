# Firebase 가이드 (Firestore 규칙 · 배포 · 테스트)

## 1. 사전 준비
```bash
npm install -g firebase-tools   # Firebase CLI 설치
firebase login                  # 구글 계정 로그인
```
- `.firebaserc`의 `YOUR_FIREBASE_PROJECT_ID`를 실제 프로젝트 ID로 교체하세요.

## 2. Security Rules 배포
```bash
firebase deploy --only firestore:rules
```

## 3. 로컬 에뮬레이터로 테스트 (권장)
```bash
firebase emulators:start --only firestore
```
규칙 변경 시 실기기/실서버에 올리기 전에 에뮬레이터에서 검증하세요.

---

## 4. ⚠️ 클라이언트 필수 규칙: "하루 1곡"은 **배치 쓰기**로

`firestore.rules`는 트랙 생성 시 아래를 강제합니다:
- 같은 배치(WriteBatch)에서 `members/{uid}.lastSubmittedDate`가 오늘 날짜(`dayId`)로 갱신되어야 하고,
- 갱신 이전 값은 오늘이 아니어야 합니다(중복 제출 차단).

따라서 곡 등록은 **트랙 문서 생성 + 멤버 문서 갱신을 하나의 배치로** 실행해야 규칙을 통과합니다.

또한 트랙 생성은 **해당 날짜(`dayId`) 문서가 서버에 존재하고 `closed != true`** 일 때만 허용됩니다.
→ 날짜/테마 문서는 Cloud Functions가 매일 자정에 생성하므로, 그 전에는 제출이 거부됩니다. (자정 마감 정책과 연동)

### Swift 예시 (Firestore)
```swift
let db = Firestore.firestore()
let batch = db.batch()

let dayId = "2026-07-13" // 오늘 날짜 (Asia/Seoul 기준)
let trackRef = db.collection("rooms").document(roomId)
    .collection("days").document(dayId)
    .collection("tracks").document()

batch.setData([
    "videoId": videoId,
    "title": title,
    "channelTitle": channelTitle,
    "thumbnailUrl": thumbnailUrl,
    "durationSec": durationSec,
    "submittedByUid": uid,
    "submittedByNickname": nickname,
    "comment": comment,          // 30자 이내
    "createdAt": FieldValue.serverTimestamp()
], forDocument: trackRef)

let memberRef = db.collection("rooms").document(roomId)
    .collection("members").document(uid)
batch.updateData(["lastSubmittedDate": dayId], forDocument: memberRef)

try await batch.commit()
```

> 트랙만 단독으로 생성하면 규칙에서 거부됩니다. 반드시 배치로 처리하세요.

---

## 5. 데이터 모델 요약
전체 스키마는 [기능명세서](기능명세서.md)의 데이터 모델 절을 참고하세요.

| 컬렉션 | 키 | 쓰기 주체 |
|---|---|---|
| `rooms/{roomId}` | 자동 ID | 방장(생성/수정), 인증 사용자(읽기) |
| `rooms/{roomId}/members/{uid}` | 사용자 UID | 본인만 |
| `rooms/{roomId}/days/{yyyy-MM-dd}` | 날짜 | **서버(Cloud Functions)만** — 테마/마감 |
| `.../days/{date}/tracks/{trackId}` | 자동 ID | 멤버(하루 1곡, 배치 쓰기) |
