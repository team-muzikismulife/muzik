# Styling Convention (React Native / Expo)

프로젝트의 UI 일관성과 기기 대응을 위해 아래 규칙을 준수합니다.

> 이 문서는 원래 CSS/웹 기준으로 작성되어 있었습니다. 이 프로젝트는 **React Native**이므로
> 원칙(디자인 토큰·고정 px 최소화·gap 우선·4상태·오버플로 방어)은 유지하고 수단만 RN 등가물로 치환했습니다.
> RN에는 CSS가 없습니다 — `%`/`clamp()`/`minmax()`/`fit-content`/`object-fit`/`!important`/hover는 **존재하지 않습니다.**

---

# Design System

- 공통 UI는 **`src/components/`의 자체 디자인 시스템**을 사용한다. (shadcn/ui는 웹 전용이라 사용 불가)
- 동일한 UI를 중복 구현하지 않는다.
- 새 공통 컴포넌트가 필요하면 **먼저 공통 컴포넌트로 추가**한 뒤 화면에서 쓴다.
- 스타일은 **`StyleSheet.create`** 로 정의한다.

---

# Design Token

**`src/theme/tokens.ts`가 유일한 소스다.** (Figma 실측값)

다음 값은 반드시 토큰을 사용한다.

| 토큰 | 용도 |
|---|---|
| `colors` | 배경·텍스트·보더·아바타 팔레트 |
| `typography` | fontSize + lineHeight + fontWeight + letterSpacing **묶음** |
| `spacing` | 여백 (4px 그리드) |
| `radius` | 라운드 |
| `size` | **치수** — 아바타·썸네일·버튼 높이·터치 타깃 |
| `shadow` | 그림자 (RN은 iOS `shadow*` / Android `elevation` 분리) |
| `hitSlop` | 터치 영역 보정 |
| `zIndex` | 레이어 순서 |
| `duration` | 애니메이션 시간 |

## Rules

- **하드코딩된 raw 숫자를 스타일에 쓰지 않는다.** `height: 376`, `fontSize: 18`, `paddingTop: 56` 같은 값은 토큰으로 승격시킨다.
- 토큰에 이미 있는 값을 인라인으로 재정의하지 않는다. (`{ fontSize: 12, lineHeight: 16 }` → `typography.tab`)
- 토큰에 없는 값이 필요하면 **토큰을 먼저 추가**한다. 화면에서 임시로 박지 않는다.

---

# Layout

## Rules

- **Flex를 기본으로 한다.** (RN은 기본이 flex, `flexDirection: 'column'`)
- 부모 영역을 기준으로 자연스럽게 확장되도록 구현한다 → `flex: 1`, `alignSelf: 'stretch'`.
- **고정 width/height 사용을 최소화한다.** 특히 화면 비중을 차지하는 요소(히어로, 카드)는 고정 px 금지.
- 비율이 중요한 요소는 **`aspectRatio`** 를 쓴다.
- 화면 크기에 비례해야 하는 요소는 **`useWindowDimensions()`** 를 쓴다.

### 좋은 예

```ts
// 히어로 — 기기 폭에 대한 비율로
hero: { width: '100%', aspectRatio: 1 }

// 또는 화면 높이 기준
const { height } = useWindowDimensions();
<View style={[styles.hero, { height: height * 0.42 }]} />
```

### 지양

```ts
hero: { height: 376 }   // SE에선 화면의 56%, Pro Max에선 39% — 같은 디자인이 아니다
```

> RN에서 `width: '100%'`는 문자열로 쓸 수 있지만, **`maxWidth`와 조합하는 웹식 패턴보다 `flex: 1`이 더 관용적**이다.

---

# Responsive (기기 대응)

웹의 breakpoint 대신 **기기 크기·안전영역·폰트 배율** 세 축을 본다.

## Rules

- **Safe Area를 반드시 처리한다.** `react-native-safe-area-context`의 `SafeAreaView` / `useSafeAreaInsets`.
  노치·다이나믹 아일랜드·홈 인디케이터 높이를 **숫자로 때우지 않는다.** (`paddingTop: 56` 금지)
- 화면 크기 분기가 필요하면 `useWindowDimensions()`를 쓴다. Media Query는 없다.
- **Dynamic Type(폰트 배율)을 고려한다.** iOS 접근성에서 글자를 키우면 고정 높이 컨테이너 안의 텍스트가 잘린다.
  - 텍스트를 담는 컨테이너는 **고정 `height` 대신 `minHeight` + `paddingVertical`** 을 쓴다.
  - 레이아웃이 반드시 유지되어야 하는 곳(탭, 배지)만 `maxFontSizeMultiplier`로 상한을 건다.
- 대상 기기 폭은 **iPhone SE(375) ~ Pro Max(440)** 를 최소 범위로 본다.

---

# Spacing

- 요소 간 간격은 margin이 아니라 **`gap`** 을 쓴다. (RN 0.71+ 지원)
- 위치를 맞추기 위한 `marginTop` / `marginLeft` 사용을 지양한다.
- `margin`보다 `padding`을 우선 고려한다.
- **4px 그리드**를 따른다.

```
4  8  12  16  20  24  32  40  48  64  80  96
```

현재 `spacing` 토큰(`xs 4` ~ `xxl 24`)은 24까지만 있다. 32 이상이 필요하면 **토큰을 확장**한다.

### 좋은 예

```ts
list: { gap: spacing.lg }
```

### 지양

```ts
item: { marginBottom: 16 }
```

---

# Sizing

| 권장 | 최소 사용 |
|---|---|
| `flex` | 고정 `px` |
| `aspectRatio` | `Dimensions.get()` (리렌더 안 됨 → `useWindowDimensions` 사용) |
| `useWindowDimensions()` | |
| `minHeight` / `maxHeight` | |
| `size` 토큰 | |

- 썸네일·아바타처럼 **의도적으로 고정 크기인 것**은 `size` 토큰으로 관리한다. (하드코딩과 구분)
- **터치 타깃은 최소 44pt** (iOS HIG). 시각적으로 작아야 하면 `hitSlop`으로 보정한다.

---

# Alignment

정렬은 아래 속성을 우선 사용한다.

- `justifyContent`
- `alignItems`
- `alignSelf`
- `gap`

Margin으로 위치를 맞추는 것을 지양한다. `position: 'absolute'` 남발 금지 — 배지·오버레이 등 꼭 필요한 곳만.

---

# Overflow

- 화면 밖으로 UI가 잘리지 않도록 구현한다. **가로 스크롤이 생기면 레이아웃 실패다.**
- 긴 텍스트는 **`numberOfLines` + `ellipsizeMode`** 로 말줄임 처리한다.
- 텍스트 옆에 고정폭 요소가 있으면 텍스트 컨테이너에 **`flex: 1` + `minWidth: 0`** 상당 처리(RN은 `flex: 1`로 충분)를 해 밀려나지 않게 한다.
- 작은 화면(SE)에서도 정상 동작해야 한다.

---

# Typography

- fontSize / fontWeight / lineHeight는 **`typography` 토큰 묶음**으로 쓴다. 개별 값을 따로 박지 않는다.
- `lineHeight`를 반드시 명시한다. (토큰에 포함되어 있음)
- `letterSpacing`은 Figma 실측값이 있을 때만.
- 색은 `style={[typography.caption, { color: colors.text80 }]}` 처럼 **토큰끼리 합성**한다. raw 숫자 합성은 금지.

---

# Image

- **`expo-image`를 사용한다.** RN `Image`는 placeholder·캐싱·lazy가 없다.
- `contentFit`(= `object-fit`)을 명시한다. 기본 `cover`.
- **로드 실패 폴백을 반드시 준다.** 썸네일이 깨지면 회색 박스만 남는 상태를 만들지 않는다.
- 썸네일은 `i.ytimg.com` 핫링크만 사용한다. (파일 저장 안 함 — YouTube 정책)
- 고정 width/height 대신 `aspectRatio`를 우선한다. (예: 유튜브 썸네일 16:9)

---

# Button (Pressable)

- 버튼 높이는 **`size` 토큰의 공통 규격**을 사용한다.
- **Pressed 상태를 반드시 제공한다.** (모바일에 hover는 없다)
  ```ts
  <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: opacity.pressed }]} />
  ```
- **Disabled 상태를 반드시 제공한다.** (`disabled` + 시각적 표현 + `accessibilityState`)
- **Loading 상태를 반드시 제공한다.** (버튼 내부 Spinner + 중복 탭 잠금)
- 터치 타깃 44pt 미만이면 `hitSlop`.

---

# Input (TextInput)

- **Label을 제공한다.** Placeholder만으로 의미를 전달하지 않는다.
- Error Message를 인풋 **바로 아래 인라인**으로 제공한다.
- Disabled 상태를 제공한다.
- **키보드가 인풋을 가리지 않게 한다** — `KeyboardAvoidingView` (iOS: `behavior="padding"`) + `keyboardShouldPersistTaps="handled"`.
- 용도에 맞는 `keyboardType` / `autoCapitalize` / `maxLength` / `returnKeyType`을 지정한다.

---

# Loading UI

| | 사용처 |
|---|---|
| **Spinner** | 버튼 내부, 짧은 단발 요청, 작은 영역 |
| **Skeleton** | 카드, 리스트, 상세 — **레이아웃이 미리 보여야 하는 화면** |

`FlatList`에는 반드시 `ListEmptyComponent`를 준다.

---

# Animation

- Transition은 필요한 경우에만.
- Duration은 `duration` 토큰 기준.
- 과도한 애니메이션 지양. **reanimated는 필요해질 때만 도입한다** (현재 미설치 — 번들 비용).

---

# Accessibility

RN에는 Semantic HTML이 없다. **접근성 속성을 명시적으로 붙여야 한다.**

- 아이콘 전용 버튼(이모지 포함)에는 **`accessibilityLabel` 필수.** 없으면 스크린리더에 아무 의미도 전달되지 않는다.
- `accessibilityRole`(`button` / `tab` / `image` / `alert`)과 `accessibilityState`(`selected` / `disabled`)를 준다.
- 터치 타깃 44pt 이상.
- Color Contrast를 고려한다. (본 앱은 다크 전용 — `text40` 이하는 보조 정보에만)
- **매초 갱신되는 텍스트**(마감 카운트다운)는 스크린리더가 계속 읽지 않도록 내부 텍스트를 숨기고 **컨테이너에 요약 라벨**을 준다.

---

# Style Rules

| 권장 | 지양 |
|---|---|
| `StyleSheet.create` | **인라인 raw 값** (`{ fontSize: 18 }`) |
| Flex + `gap` | `margin`으로 위치 조정 |
| 디자인 토큰 | **하드코딩된 width/height** |
| `aspectRatio` / `useWindowDimensions` | `position: 'absolute'` 남발 |
| 토큰 합성 (`[typography.body, { color: colors.text60 }]`) | 중복 스타일 |

> **인라인 스타일의 구분**: 토큰끼리 합성하는 배열 스타일은 관용적이며 문제 없다.
> 금지 대상은 **토큰 밖의 raw 숫자·색상을 인라인으로 박는 것**과, `contentContainerStyle={{...}}`처럼
> 매 렌더 새 객체가 생성되는 **정적 스타일의 인라인 전달**이다. 후자는 상수로 빼거나 `StyleSheet`로 옮긴다.

---

# Checklist

개발 완료 전 확인한다.

- [ ] SE(375) ~ Pro Max(440)에서 레이아웃이 깨지지 않는가?
- [ ] Safe Area(노치·홈 인디케이터)를 숫자가 아닌 `insets`로 처리했는가?
- [ ] 폰트를 키워도(Dynamic Type) 텍스트가 잘리지 않는가?
- [ ] 고정 width/height를 최소화했는가? 히어로·카드에 `aspectRatio`를 썼는가?
- [ ] 디자인 토큰을 썼는가? 매직넘버가 남아 있지 않은가?
- [ ] `gap`을 썼는가? margin으로 위치를 맞추지 않았는가?
- [ ] Loading / Empty / Error 세 상태를 다 만들었는가? `ListEmptyComponent`가 있는가?
- [ ] Pressed / Disabled / Loading 상태를 제공하는가?
- [ ] 아이콘 버튼에 `accessibilityLabel`이 있는가? 터치 타깃이 44pt 이상인가?
- [ ] 이미지 로드 실패 시 폴백이 있는가?
- [ ] 긴 텍스트에 `numberOfLines`가 있는가?
