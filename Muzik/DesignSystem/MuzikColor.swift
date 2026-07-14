import SwiftUI

/// Figma `playlist` 파일의 색상 토큰.
enum MuzikColor {
    /// 앱 배경. 팀 카드 배경도 같은 값이라 카드는 테두리로만 구분된다.
    static let background = Color(hex: 0x121212)
    static let cardBackground = Color(hex: 0x121212)

    static let textPrimary = Color.white
    static let textSecondary = Color(hex: 0x999999)
    /// "새 기록 · 3명 참여중"의 가운뎃점.
    static let textTertiary = Color.white.opacity(0.5)

    /// "새 기록" 뱃지.
    static let accent = Color(hex: 0x9C8FFF)

    static let cardBorder = Color.white.opacity(0.6)
    static let divider = Color.white.opacity(0.1)

    /// 새 팀 개설하기 버튼 (점선 테두리).
    static let dashedBorder = Color.white.opacity(0.2)
    static let dashedFill = Color.white.opacity(0.03)

    /// 프로필 이미지가 없을 때 채우는 원.
    static let avatarPlaceholder = Color.white.opacity(0.16)

    /// Figma 변수 `colors/main000`.
    static let main000 = Color(hex: 0xEBF8FE)

    // MARK: - 팀 플레이리스트 (Figma `App` 프레임 40:1574)

    /// 곡 추가 카드처럼 배경 위에 한 단 떠 있는 면.
    static let surface = Color(hex: 0x1E1E1E)

    /// 앨범 아트 위에 덮어 글자 대비를 확보하는 막.
    static let artworkScrim = Color.black.opacity(0.6)
    /// 앨범 아트가 없을 때 카드를 채우는 색.
    static let artworkPlaceholder = Color(hex: 0x2A2A2A)

    /// 트랙 카드의 한 줄 코멘트 바.
    static let commentBackground = Color.white.opacity(0.25)

    /// 날짜 칩 — 선택되면 흰 배경에 배경색 글자로 반전된다.
    static let chipBackground = Color.white.opacity(0.05)
    static let chipSelectedBackground = Color.white
    static let chipSelectedText = Color(hex: 0x121212)

    /// 추천 배너의 좌→우 그라데이션과 테두리.
    static let bannerGradientStart = Color(hex: 0x9810FA, opacity: 0.6)
    static let bannerGradientEnd = Color(hex: 0xE60076, opacity: 0.6)
    static let bannerBorder = Color(hex: 0xAD46FF, opacity: 0.3)
    static let bannerButtonBackground = Color.white.opacity(0.1)

    /// 알림 아이콘의 읽지 않음 점.
    static let notificationDot = Color(hex: 0xFB2C36)

    /// 아티스트명·날짜 칩처럼 한 단 죽인 글자.
    static let textMuted = Color.white.opacity(0.6)
    /// "+ 곡 추가하기"처럼 가장 약한 글자.
    static let textDisabled = Color.white.opacity(0.4)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
