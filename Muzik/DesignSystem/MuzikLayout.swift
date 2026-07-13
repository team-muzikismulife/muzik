import CoreGraphics

/// Figma `playlist` 파일의 간격 스케일.
enum MuzikSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum MuzikRadius {
    static let card: CGFloat = 8
}

enum MuzikBorder {
    static let hairline: CGFloat = 1
    /// 새 팀 개설하기 버튼의 점선 패턴.
    static let dashPattern: [CGFloat] = [4]
}

enum MuzikSize {
    static let profileAvatar: CGFloat = 32
    static let memberAvatar: CGFloat = 24
    /// 아바타끼리 겹치는 양 — HStack에 음수 spacing으로 적용한다.
    static let memberAvatarOverlap: CGFloat = 4
    static let icon: CGFloat = 20
}
