# Frontend Convention (React Native / Expo)

프로젝트의 일관성과 유지보수성을 위해 아래 규칙을 준수합니다.

> 이 문서는 원래 Next.js 웹 기준으로 작성되어 있었습니다. 이 프로젝트는 **React Native (Expo)** 이므로
> 원칙(토큰·상태 분리·4상태·매직넘버 금지)은 유지하고 수단만 RN 등가물로 치환했습니다.
> 스타일링 규칙은 `docs/design.md` 참조.

---

# Tech Stack

- React Native 0.79 / **Expo SDK 53**
- **expo-router** (파일 기반 라우팅, typedRoutes)
- TypeScript (strict)
- **Zustand** (전역 상태) + **AsyncStorage** (영속)
- **Firebase** (Anonymous Auth, Firestore, Cloud Functions)
- **zod** (스키마 검증 — 클라이언트/Functions 공용)
- `react-native-youtube-iframe` (인앱 미리듣기)

### 쓰지 않는 것과 그 이유

| 항목 | 이유 |
|---|---|
| Server Component / `"use client"` / Streaming | RN에 존재하지 않는 개념 |
| TanStack Query | 서버 상태가 Firestore **실시간 구독(onSnapshot)** 이라 fetch/cache/invalidate 모델과 맞지 않음. 구독 레이어 + Zustand가 정석 |
| nuqs | URL State는 expo-router `useLocalSearchParams`로 해결 |
| shadcn/ui | 웹 전용(Radix + Tailwind). 공통 UI는 `src/components/`에 자체 구축 |
| react-hook-form | 폼이 3개(닉네임·방 생성·곡 등록)뿐. `useState` + zod로 충분 |
| Suspense (데이터) | RN에서 데이터 Suspense 미지원 → `StateView`로 4상태 처리 |

---

# Component

## Rules

- 컴포넌트는 하나의 책임만 갖는다.
- 화면(route)은 **조립만** 한다. 로직은 hook, 표현은 컴포넌트로 내린다.
- 재사용 UI는 `src/components/`에 둔다. 화면 파일 안에서 중복 구현하지 않는다.
- 새 공통 컴포넌트가 필요하면 **먼저 공통 컴포넌트로 추가**한 뒤 사용한다.

## Directory

```
app/                    # expo-router 라우트 (화면 조립만)
src/components/         # 재사용 UI (프레젠테이션)
src/lib/                # 순수 로직·API·유틸 (RN 의존 최소)
src/store/              # Zustand 스토어
src/schemas/            # zod 스키마 (Functions와 공유되는 계약)
src/theme/tokens.ts     # 디자인 토큰 (유일한 소스)
src/types/              # 도메인 타입
```

---

# State Management

상태의 역할을 명확하게 구분한다.

| 종류 | 사용 | 예 |
|---|---|---|
| Server State | **Firestore onSnapshot → Zustand `room` store** | members, todayTracks, days |
| URL State | **expo-router `useLocalSearchParams`** | roomId, dateKey, trackId |
| Global UI State | Zustand (`session`, `ui`) | uid, nickname, toast, handoffMode |
| Local UI State | `useState` | 입력값, 큐 인덱스, 모달 내부 상태 |

## Rules

- **서버 상태를 화면 로컬 `useState`에 복사하지 않는다.** 구독 → store → 화면 단방향.
- 구독은 **`useFocusEffect` 안에서만** 시작하고, 포커스를 벗어나면 반드시 unsubscribe 한다. (Firestore 읽기 비용 직결)
- 파생 값은 store에 저장하지 않고 **selector로 계산**한다. (예: `doneToday = todayTracks.some(t => t.uid === uid)`)
- 전역 상태는 꼭 필요한 경우에만 쓴다.

---

# URL State

다음은 라우트 파라미터로 관리한다.

- roomId (`/room/[id]`)
- dateKey (`/room/[id]/playlist/[dateKey]`)
- 초대 코드 (`/r/[code]`)

**모달은 라우트로 표현한다.** expo-router의 `presentation: 'modal'`을 쓴다 — 뒤로가기·상태복원·딥링크가 공짜로 따라온다.

```
app/room/[id]/track/new.tsx        # 곡 등록
app/room/[id]/track/[trackId].tsx  # 곡 수정/삭제
app/room/[id]/members.tsx          # 멤버·공유
```

Toast / Loading / 큐 인덱스 같은 **일시적 상태는 URL에 넣지 않는다.**

---

# Data Fetching

- **쓰기는 전부 Cloud Functions callable을 경유한다.** 클라이언트는 Firestore 읽기 전용.
- 컴포넌트 안에서 `getDoc`/`onSnapshot`/`httpsCallable`을 직접 호출하지 않는다. **`src/lib/db.ts`(읽기) / `src/lib/api.ts`(쓰기) 레이어를 통한다.**
- `onSnapshot`은 반드시 **에러 콜백까지** 등록한다. 조용히 죽는 구독을 만들지 않는다.

```ts
// 지양
onSnapshot(q, (snap) => setTracks(...))

// 권장
onSnapshot(q, (snap) => set({ tracks: ... }), (err) => set({ status: 'error', error: err }))
```

---

# Form & Validation

- 폼 상태는 `useState`로 관리한다. (폼이 3개뿐이라 react-hook-form 도입 이득 없음)
- **검증은 zod 스키마로 한다.** 정규식·길이 체크를 화면에 흩뿌리지 않는다.
- 스키마는 `src/schemas/`에 두고 **Cloud Functions와 같은 정의를 공유**한다 — 클라와 서버의 검증 규칙이 갈라지는 것을 막는다.

```ts
// src/schemas/track.ts
export const CommentSchema = z.string().trim().max(30, '코멘트는 30자까지예요');
export const VideoIdSchema = z.string().regex(/^[\w-]{11}$/, '유튜브 링크가 아닌 것 같아요');
```

- **에러 메시지는 스키마에 담는다.** 화면은 메시지를 만들지 않고 받아서 보여주기만 한다.

---

# 4상태 (Loading / Success / Empty / Error)

비동기 화면은 **네 상태를 반드시 모두 구현**한다. 하나라도 빠지면 그 화면은 미완성이다.

- 공통 `StateView` 컴포넌트로 loading / empty / error를 처리한다.
- **Skeleton**: 리스트·카드·상세처럼 레이아웃이 미리 보여야 하는 곳.
- **Spinner**: 버튼 내부, 짧은 단발 요청.
- `FlatList`에는 **반드시 `ListEmptyComponent`를 준다.**

---

# Error Handling

- 루트에 **ErrorBoundary**를 둔다. (expo-router: 라우트 파일에서 `ErrorBoundary`를 named export)
- API 에러는 **`src/lib/errors.ts` 한 곳에서** Firebase 에러 코드 → 한국어 메시지로 매핑한다.
- `alert()` 사용 금지. 파괴적 액션 확인만 RN `Alert`, 그 외 안내는 **Toast**.
- 사용자에게 **다음 행동을 준다.** "에러가 발생했습니다"로 끝내지 않고 [다시 시도] / [홈으로]를 붙인다.
- `already-exists`(하루 1곡 위반)처럼 **에러가 아니라 분기인 것**은 에러로 취급하지 않는다 → "내 곡 수정하기"로 연결.

---

# Performance

- `FlatList`의 `contentContainerStyle` 등 **정적 스타일 객체를 인라인으로 넘기지 않는다.** (매 렌더 새 객체 → 불필요한 리렌더)
- `keyExtractor`는 안정적인 ID를 쓴다. **배열 인덱스 금지.**
- 구독은 화면 포커스 중에만 유지한다.
- `React.memo` / `useMemo` / `useCallback`은 **측정 후** 적용한다. 선제 최적화 금지.

---

# TypeScript

- strict mode. `any` 금지.
- Firestore 문서 타입은 `src/types/models.ts`에 **단일 정의**하고 Functions와 공유한다.
- Cloud Functions의 입력/출력 타입을 정의한다. `httpsCallable<Req, Res>`로 계약을 강제한다.

---

# React Rules

- Hook 규칙 준수.
- **불필요한 `useEffect` 금지.** 특히 "props에서 state 동기화"용 useEffect는 만들지 않는다.
- **Derived State 금지.** 계산 가능한 값은 렌더 중에 계산한다.
- Key는 안정적인 값. (현행 `${uid}_${dateKey}` 유지)

---

# Common

- `console.log`는 커밋 전에 제거한다.
- TODO는 **주차/마일스톤과 함께** 작성한다. (`// TODO(M2): …`)
- **매직넘버 금지.** 치수·색·간격·시간은 전부 `src/theme/tokens.ts` 또는 `src/lib/constants.ts`.
- 공통 로직은 hook 또는 util로 분리한다.
- 중복 구현보다 재사용을 우선한다. **`src/lib`에 이미 있는 것을 다시 짜지 않는다.**
  (`todayKey` / `msUntilCutoff` / `extractVideoId` / `fetchVideoMeta` / `buildWatchVideosUrl` / `themeFor`)
- 기존 컨벤션을 우회하는 구현은 지양한다.
- **UI 텍스트·주석은 한국어.**
