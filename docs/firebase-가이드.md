> ⚠️ **SUPERSEDED (구버전).** 이 가이드는 클라이언트가 Firestore에 직접 쓰던 모델(트랙ID=UID, 자정 마감) 기준이다.
> v2는 **쓰기 전부 Cloud Functions 경유·읽기 전용 Rules, 트랙ID=`{uid}_{dateKey}`, 자정 마감**으로 변경됨.
> 정본: [백엔드설계.md](백엔드설계.md)(§4 Rules 초안 포함) · [ERD.md](ERD.md).

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

## 4. ⚠️ 클라이언트 필수 규칙: "하루 1곡"은 **트랙 ID = 사용자 UID**

`firestore.rules`는 트랙 문서 ID가 **제출자 UID와 같아야** 생성을 허용합니다.
→ (방, 날짜, 사용자)당 트랙 문서가 **물리적으로 최대 1개만** 존재하므로 하루 1곡이 규칙 우회 없이 강제됩니다.
→ 재제출은 기존 문서 `update`가 되어 거부됩니다. (별도 배치 쓰기 불필요, 클라이언트 단순)

또한 트랙 생성은 **해당 날짜(`dayId`) 문서가 서버에 존재하고 `closed == false`** 일 때만 허용됩니다.
→ 날짜/테마 문서는 Cloud Functions가 매일 자정에 생성하므로, 그 전에는 제출이 거부됩니다. (자정 마감 정책과 연동)

### Swift 예시 (Firestore)
```swift
let db = Firestore.firestore()
let dayId = "2026-07-13" // 오늘 날짜 (Asia/Seoul 기준)

// 문서 ID를 본인 UID로 고정 → 하루 1곡 강제
let trackRef = db.collection("rooms").document(roomId)
    .collection("days").document(dayId)
    .collection("tracks").document(uid)

try await trackRef.setData([
    "videoId": videoId,
    "title": title,
    "channelTitle": channelTitle,
    "thumbnailUrl": thumbnailUrl,
    "durationSec": durationSec,
    "submittedByUid": uid,
    "submittedByNickname": nickname,
    "comment": comment,          // 30자 이내
    "createdAt": FieldValue.serverTimestamp()
])
```

> "오늘 이미 제출했는지"는 `days/{today}/tracks/{uid}` 문서 존재 여부로 판단하면 됩니다.

---

## 5. 데이터 모델 요약
전체 스키마는 [기능명세서](기능명세서.md)의 데이터 모델 절을 참고하세요.

| 컬렉션 | 키 | 쓰기 주체 |
|---|---|---|
| `rooms/{roomId}` | 자동 ID (= 초대코드, 링크 `/r/{roomId}`) | 방장(생성/수정), 인증 사용자(읽기) |
| `rooms/{roomId}/members/{uid}` | 사용자 UID | 본인만 (`nickname`/`joinedAt`만) |
| `rooms/{roomId}/days/{yyyy-MM-dd}` | 날짜 | **서버(Cloud Functions)만** — 테마/마감 |
| `.../days/{date}/tracks/{uid}` | = 제출자 UID | 멤버(하루 1곡, 단일 쓰기) |
