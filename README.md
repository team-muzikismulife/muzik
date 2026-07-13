# MUZIK IS MY LIFE 🎵

지인 그룹이 **하루 한 곡씩** 유튜브 음원을 추천해 함께 만드는 데일리 공유 플레이리스트 iOS 앱.

- **팀:** 김승완 · 김보규 · 정규호 (글로벌미디어학부)
- **플랫폼:** iOS — **React Native (Expo SDK 53, expo-router)**
- **백엔드:** Firebase (Firestore · Anonymous Auth · Cloud Functions)

## 핵심 컨셉
- 초대 코드 6자리 / 딥링크 한 번으로 즉시 입장 (회원가입 없음, 익명 인증)
- 하루 1인 1곡 제한 → 선곡 품질 ↑, 매일 방문 유도
- 오늘의 미션 + 30자 한 줄 코멘트
- **유튜브 앱 핸드오프**로 전곡 연속 재생 (인앱 IFrame은 미리듣기 보조)
- **새벽 4시 마감** & 날짜별 영구 아카이빙

## 시작하기

```bash
npm install
npx expo start        # iPhone에서 Expo Go로 QR 스캔
npm run lint          # tsc --noEmit
```

Firebase 키는 `.env` (`.env.example` 참고). 백엔드 개발은 Emulator Suite 사용.

## 문서

| 문서 | 내용 |
|---|---|
| [요구명세서](docs/요구명세서.md) · [기능명세서](docs/기능명세서.md) · [개발계획](docs/개발계획.md) | 제품 기획 |
| [frontend.md](docs/frontend.md) | **프론트 컨벤션 (RN/Expo)** — 스택, 상태 분리, 데이터 레이어, 4상태, 에러 처리 |
| [design.md](docs/design.md) | **스타일링 컨벤션 (RN)** — 디자인 토큰, 반응형·SafeArea·Dynamic Type, 접근성 |
| [구현계획서](docs/구현계획서.md) | MVP 계획 v2 — 아키텍처, 핵심 설계 결정 |
| [백엔드설계](docs/백엔드설계.md) | Firestore 스키마, Cloud Functions 명세, Security Rules |
| [유튜브연동설계](docs/유튜브연동설계.md) | 등록 파이프라인, 핸드오프 재생, 킬스위치, **썸네일 파생 규칙** |
| [곡등록설계](docs/곡등록설계.md) | 곡 등록 모달 — 파이프라인, 상태 머신, 에러 처리 |
| [firebase-가이드](docs/firebase-가이드.md) | Firebase 초기 설정 |
| [convention.md](convention.md) | 브랜치·커밋·PR 컨벤션 |

## 핵심 설계 결정

1. **새벽 4시(KST) 마감** — `dateKey` = (현재시각 −4h)의 KST 날짜. 밤 11시~새벽 감상 패턴을 존중.
2. **하루 1곡** — tracks 문서 ID `{uid}_{dateKey}` + create-only로 원천 차단.
3. **재생 = 유튜브 핸드오프** — `watch_videos` URL로 무인증·무쿼터 연속 재생. 킬스위치 `config/app.handoffMode`.
4. **videoId만이 영구 원본** — 썸네일 URL은 저장하지 않고 파생한다. 근거는 `유튜브연동설계.md` §5-1.
5. 디자인 값은 `src/theme/tokens.ts`가 유일한 소스 (Figma 실측값). 하드코딩 금지.

## 구조

```
app/              # expo-router 라우트 (온보딩 / 팀 홈 / 플레이리스트 상세 / 초대 / 404)
src/theme/        # Figma 디자인 토큰 (colors, typography, spacing, radius, size, aspect, shadow …)
src/components/   # 도메인(Avatar, MissionBanner, TrackCard, TeamCard, DateTabs, YoutubeArt)
                  # 공통(Screen, StateView, Skeleton, Icon, PressableScale, Toast)
src/lib/          # date(dateKey·컷오프), youtube(파싱·oEmbed·썸네일 파생), themes, errors
src/schemas/      # zod — 클라이언트/Functions 공용 검증 계약
src/store/        # zustand
src/types/        # Firestore 데이터 모델
assets/fonts/     # Pretendard (Regular / Medium / SemiBold)
```
