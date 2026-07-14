# MUZIK IS MY LIFE

그룹 음악 공유 iOS 앱 — 유튜브 링크로 하루 한 곡씩 올려 함께 만드는 데일리 플레이리스트.
React Native (Expo SDK 53, expo-router) + Firebase (Anonymous Auth, Firestore, Cloud Functions).

## Instructions

- **구현 계획은 반드시 `docs/`에 파일로 남길 것.** 새 기능/주차 작업 시작 전 설계 문서 작성 또는 기존 문서 갱신이 선행됨.
- 기존 설계 문서를 먼저 읽고 그 결정을 따를 것. 결정을 바꿀 땐 해당 문서를 함께 수정.
- **코드를 쓰기 전 `docs/frontend.md`·`docs/design.md`를 따를 것.** (RN/Expo 기준 — 웹 규칙 아님)
- 디자인 값은 `src/theme/tokens.ts`가 유일한 소스 (Figma 실측값). 하드코딩 금지.
- UI 텍스트·주석은 한국어.

## 문서 맵 (docs/)

| 문서 | 내용 |
|---|---|
| `frontend.md` | **프론트 컨벤션 (RN/Expo)** — 스택, 상태 분리, 데이터 레이어, 4상태, 에러 처리, TS 규칙 |
| `design.md` | **스타일링 컨벤션 (RN)** — 디자인 토큰, 반응형·SafeArea·Dynamic Type, 접근성, 체크리스트 |
| `구현계획서.md` | 전체 MVP 계획 v2 — 아키텍처, 핵심 설계 결정 4개, 주차별 일정 |
| `유튜브연동설계.md` | 등록 파이프라인, 핸드오프 재생, 킬스위치, 쿼터, 30일 캐시 정책 대응 |
| `백엔드설계.md` | **Firestore 스키마 정본**, Functions 6개 명세, Security Rules, 구독 전략, M1 함정 |
| `온보딩구현계획.md` | 온보딩(#14) — 익명 로그인, 참여 중인 팀 목록(collectionGroup), 팀 개설 |

## 핵심 설계 결정 (요약 — 상세는 docs/)

1. **새벽 4시(KST) 마감**: `dateKey` = (현재시각 −4h)의 KST 날짜. `src/lib/date.ts`. 등록 시 dateKey는 Functions 서버 시각으로 확정.
2. **하루 1곡**: tracks 문서 ID `{uid}_{dateKey}` + create-only.
3. **쓰기는 전부 Cloud Functions 경유**, 클라이언트는 Firestore 읽기 전용.
4. **재생 = 유튜브 핸드오프**: `watch_videos?video_ids=` URL로 유튜브 앱에서 연속 재생. 인앱 IFrame은 '미리듣기' 보조. 킬스위치: `config/app.handoffMode`.
5. **테마**: `src/lib/themes.ts` 내장 풀에서 dateKey 해시로 결정론적 선택.
   **오늘 = 클라 계산**(곡 0개면 days 문서가 없는데 배너는 등록 전에도 떠야 함),
   **과거 = `days.themeText` 스냅샷**(THEMES 풀이 바뀌어도 과거 기록이 소급 변조되면 안 됨).
6. **초대**: 6자리 코드(`invites/{code}` 역참조) + `muzik://r/{code}` 딥링크 병행.
7. Data API는 `videos.list` 검증만 (API 키는 Functions 전용, 앱에 넣지 말 것). `playlists.insert` 사용 금지.
8. **videoId만이 영구 원본.** 썸네일 URL은 **저장하지 않고 파생**한다(`src/lib/youtube.ts`).
   따로 저장하면 videoId와 어긋난다 — 실제로 어긋났었다. 목업도 **실제 videoId의 실제 메타**여야 한다.
   유튜브 썸네일엔 함정 둘: `maxresdefault`는 404가 잦고, `sd`/`hqdefault`는 4:3 레터박스다.
   → `YoutubeArt`가 폴백 체인 + 16:9 박스로 둘 다 처리한다. 상세는 `유튜브연동설계.md` §5-1.

## 구조

```
app/                    # expo-router 라우트 (온보딩 / room/[id] 홈 / playlist/[dateKey] 상세 / r/[code] 초대 / +not-found)
assets/fonts/           # Pretendard Regular/Medium/SemiBold (Figma 전 구간이 Pretendard)
src/theme/tokens.ts     # Figma 디자인 토큰 (colors, typography, spacing, radius, size, aspect, shadow, hitSlop …)
src/components/         # 도메인: Avatar, MissionBanner, TrackCard(+AddTrackCard), TeamCard, DateTabs, Thumbnail
                        # 공통: Screen, StateView, Skeleton, Icon(+IconButton), PressableScale, Toast
src/lib/                # date(dateKey·컷오프), youtube(파싱·oEmbed·핸드오프URL), themes, firebase, errors
src/schemas/            # zod — 클라이언트/Functions 공용 검증 계약
src/store/              # zustand — ui(토스트). (예정) session, room
src/types/models.ts     # Room, Member, Track, DailyTheme
functions/              # (예정) Cloud Functions — 백엔드설계.md §3 명세대로
```

**UI 용어**: 화면에는 **"팀"**(방 X), **"오늘의 미션"**(테마 X)으로 쓴다. 코드 내부 식별자
(`rooms` 컬렉션, `roomId`, `themeFor`)는 Firestore 스키마와 맞추기 위해 그대로 둔다.

## 명령어

```bash
npm install && npx expo install --fix   # 최초 셋업
npx expo start                          # 개발 서버 (iPhone Expo Go로 QR 스캔)
npm run lint                            # tsc --noEmit
```

Firebase 키는 `.env` (`.env.example` 참고). 백엔드 개발은 Emulator Suite 사용.

## 진행 상태 (마일스톤 M0~M5)

주차가 아니라 **"실기기에서 무엇을 보여줄 수 있는가"** 로 끊는다.
상태 UI·접근성·에러 처리를 6주차 QA에 몰지 않고 M0에 선불로 깐 이유: 그러지 않으면 매 단계가
"보여줄 순 있지만 로딩하면 흰 화면"인 데모가 된다.

- [x] 스캐폴드 + Figma 토큰 + 3화면 정적 UI (목데이터)
- [x] **M0** — 로딩·빈 상태·에러·VoiceOver에서 무너지지 않는 앱 (Firebase 불필요)
      토큰 확장(size/aspect/shadow/hitSlop), 공통 상태 UI 6종, SafeArea, ErrorBoundary,
      키보드 회피, zod 검증, 44pt 터치 타깃, 히어로 고정 376px → aspect 비율
- [x] **Figma 재동기화** (2026-07-13, node 1:2125 온보딩 / 1:1732 홈)
      Pretendard 도입, 이모지 → 벡터 아이콘, 미션 배너를 카드 → **풀블리드 스트립**(카운트다운 제거),
      트랙 카드 배경을 **앨범아트 + 60% 오버레이**로, 수정/삭제 버튼 → **⋯ 메뉴**,
      팀 카드(보더형 + "새 기록" 배지), 곡 카드를 **팀원 수만큼 나열**(누가 안 올렸는지 보이게)
- [x] **Figma 정본 노드 확정** (2026-07-14) — 온보딩 `107:1126` / 홈 `157:744`
      파일에 경쟁 시안이 남아 있다. **온보딩 `107:703`**(컬러 보더·이모지)과 **홈 `107:569`**(미션 카드형)은
      **탈락안**이다. 홈은 `157:744`(풀블리드 스트립)가 정본 — "카드 → 스트립" 결정과 일치한다.
      팀 이모지는 쓰지 않는다(팀 이름만). 헤더의 팀 드롭다운(⌄)은 온보딩으로 복귀 = 팀 전환.
- [ ] **M1** — 방 생성 → 코드 공유 → 다른 기기 입장 → 멤버 실시간 반영
      (Emulator Suite, `functions/`, createRoom/joinRoom, 익명 로그인 + AsyncStorage 영속)
- [ ] **M2** — 링크 붙여넣기 → 미리보기 → 등록 → 상대 기기에 즉시 표시. 하루 2곡은 서버가 거부
- [ ] **M3** — 유튜브 앱에서 전곡 연속 재생 + 킬스위치 즉시 전환
- [ ] **M4** — 과거 날짜별 플레이리스트, 당일 본인 곡만 수정·삭제
- [ ] **M5** — Security Rules 하드닝 + 실 Firebase 프로젝트 + TestFlight
