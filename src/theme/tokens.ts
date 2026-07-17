/**
 * 디자인 토큰 — Figma "playlist" 실측값 (2026-07-13 최신 이터레이션 반영)
 * 온보딩: node 1:2125 / 홈: node 1:1732 / 플레이리스트 상세: node 4:1332
 *
 * 여기가 디자인 값의 유일한 소스다. 화면·컴포넌트에서 raw 숫자를 쓰지 말 것.
 * 규칙: docs/design.md
 */
export const colors = {
  bg: '#121212',
  card: '#1E1E1E', // 곡 미등록 카드 (앨범아트 배경이 없는 경우)
  // white 알파 스케일 (Figma에서 반복 사용되는 오버레이)
  white1: 'rgba(255,255,255,0.01)', // 곡 추가 점선 박스 배경
  white3: 'rgba(255,255,255,0.03)', // 팀 개설 점선 버튼 배경
  white5: 'rgba(255,255,255,0.05)', // 날짜 탭 비활성
  white10: 'rgba(255,255,255,0.1)', // 헤더 하단 보더, CTA
  white20: 'rgba(255,255,255,0.2)', // 점선 보더
  white25: 'rgba(255,255,255,0.25)', // 코멘트 박스 (앨범아트 위라 밝다)
  white60: 'rgba(255,255,255,0.6)', // 팀 카드 보더
  black40: 'rgba(0,0,0,0.4)', // 상세 헤더 원형 버튼
  /** 트랙 카드의 앨범아트 위에 까는 오버레이 — 이게 없으면 텍스트가 안 읽힌다 */
  artOverlay: 'rgba(0,0,0,0.6)',
  text: '#FFFFFF',
  text80: 'rgba(255,255,255,0.8)',
  text60: 'rgba(255,255,255,0.6)', // 아티스트명, 비활성 탭
  text50: 'rgba(255,255,255,0.5)', // 구분점 ·
  text40: 'rgba(255,255,255,0.4)', // 곡 추가하기 플레이스홀더
  textMuted: '#999999', // "N명 참여중"
  accent: '#9C8FFF', // "새 기록" 배지
  divider: 'rgba(255,255,255,0.1)', // 헤더 하단 보더
  notifDot: '#FB2C36',
  danger: '#FB2C36',
  skeleton: 'rgba(255,255,255,0.07)',
  toastBg: '#2A2A2A',
  /** 미션 배너 그라데이션 — Figma: 알파 0.6 (구버전 0.2보다 훨씬 진하다) */
  missionFrom: 'rgba(152,16,250,0.6)',
  missionTo: 'rgba(230,0,118,0.6)',
  missionBorder: 'rgba(173,70,255,0.3)',
  /** 히어로 하단 그라데이션 (투명 → bg) */
  heroFade: ['rgba(0,0,0,0)', 'rgba(18,18,18,0.8)', '#121212'],
  /** 아바타 배경 — 닉네임 해시로 결정론적 선택. 서버(members.photoColor)와 같은 인덱스 규칙 */
  avatarPalette: ['#7C5CFF', '#E60076', '#4ADE80', '#F59E0B', '#38BDF8'],
} as const;

/** Pretendard — expo-font로 로드 (app/_layout.tsx). Figma 전 구간이 Pretendard다. */
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
} as const;

/**
 * Figma는 line-height를 1.4 배수로 쓴다 — RN은 절대값이 필요하므로 fontSize × 1.4로 환산.
 * tracking(letterSpacing)도 Figma 실측값.
 */
export const typography = {
  /** 히어로 타이틀 (상세 화면) */
  heroTitle: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 34, letterSpacing: -0.096, color: colors.text },
  /** 화면 제목, 팀 이름, 곡 제목 — 20/28 */
  title: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 28, letterSpacing: -0.08, color: colors.text },
  /** 본문 16/22 */
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.text },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.text },
  /** 팀 이름 (온보딩 카드) */
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.text },
  /** 보조 14/20 — 아티스트명, 코멘트, 미션 텍스트 */
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.text60 },
  captionMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.text },
  /** 날짜 탭 — tracking이 양수(+0.056)라 위와 다르다 */
  tab: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.056, color: colors.text60 },
  /** 아바타 이니셜 — fontSize는 size에 비례하므로 컴포넌트에서 계산 */
  avatarInitial: { fontFamily: fonts.semibold, color: colors.text },
} as const;

/** 4px 그리드 (docs/design.md) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  /** 트랙 카드 — 헤더와 곡 정보 사이 (앨범아트를 드러내는 여백) */
  art: 80,
} as const;

export const radius = {
  thumb: 4, // 코멘트 박스, 상세 썸네일
  sm: 8, // 팀 카드, 곡 추가 점선 박스
  input: 10,
  card: 12, // 트랙 카드 (Figma 최신: 16 → 12)
  lg: 16,
  full: 999,
} as const;

/** 치수 — "의도적으로 고정 크기인 것"만. 화면 비중 요소는 aspect로. */
export const size = {
  avatarSm: 24, // 온보딩 팀 카드 아바타 스택, 트랙 행 미니
  avatarMd: 32, // 홈 카드, 헤더 프로필
  avatarLg: 40,
  thumbSm: 56, // 상세 트랙 행
  thumbLg: 80,
  icon: 20, // arrow-right, plus, chevron, more
  iconLg: 24, // 헤더 벨, chevron-down, arrow-right-sm
  tabHeight: 32, // 날짜 탭 (minHeight)
  ctaSm: 36,
  ctaLg: 48,
  addBox: 44, // 곡 추가 점선 박스 (py12 + 20 아이콘)
  /** iOS HIG 최소 터치 타깃 */
  touch: 44,
  notifDot: 8,
  player: 200,
  skeletonLine: 12,
  missionStrip: 40, // 미션 스트립 (py8 + 텍스트 20 + 여유)
  /**
   * 앱 최대 폭 — **웹 전용**. 데스크톱 브라우저에서 앱이 뷰포트 전체로 늘어나면
   * 모바일 기준 비율(히어로·카드 aspect)이 깨진다. 이 폭으로 가운데 컬럼을 만들어
   * 실기기와 같은 비율을 유지한다. 네이티브에선 적용하지 않는다(전체 폭).
   */
  appMaxWidth: 430, // 대형 폰 폭 기준 (iPhone Pro Max 430)
} as const;

/** 비율 — 기기 폭에 따라 늘어나야 하는 요소 */
export const aspect = {
  hero: 390 / 376, // 상세 히어로
  trackCard: 345 / 260, // 트랙 카드 (앨범아트 배경) — 폭 345 기준 Figma 높이
  thumbnail: 16 / 9,
} as const;

/** 터치 영역 보정 — 시각적으로 44pt 미만인 버튼에 필수 */
export const hitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

export const opacity = {
  pressed: 0.6,
  disabled: 0.4,
  done: 0.5,
} as const;

export const shadow = {
  /** 카드 아바타 glow — Figma: 0 0 10px rgba(255,255,255,0.25) */
  avatarGlow: {
    shadowColor: colors.text,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  /** 겹침 아바타 — Figma: -4.8 0 4.8 rgba(0,0,0,0.4) */
  avatarStack: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 4.8,
    shadowOffset: { width: -4.8, height: 0 },
    elevation: 2,
  },
  toast: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

export const zIndex = {
  toast: 100,
} as const;

export const duration = {
  fast: 150,
  base: 250,
  toast: 2600,
} as const;

/** 폰트 배율 상한 — 레이아웃이 반드시 유지돼야 하는 곳(탭·배지)에만 */
export const fontScale = {
  tight: 1.3,
} as const;
