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
