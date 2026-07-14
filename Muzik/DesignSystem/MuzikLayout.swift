import CoreGraphics

/// Figma `playlist` 파일의 간격 스케일.
enum MuzikSpacing {
    static let xxs: CGFloat = 2
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    /// 트랙 카드에서 멤버 줄과 곡 정보 사이를 벌려 앨범 아트를 드러내는 간격.
    static let trackCardGap: CGFloat = 80
}

enum MuzikRadius {
    static let card: CGFloat = 8
    /// 트랙 카드·추천 배너.
    static let largeCard: CGFloat = 12
    /// 코멘트 바, 곡 추가 버튼.
    static let small: CGFloat = 4
    /// 날짜 칩, 배너의 "참여하기" 버튼 — 캡슐.
    static let pill: CGFloat = 999
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
    /// 헤더의 알림 벨.
    static let headerIcon: CGFloat = 24
    /// 벨 위의 읽지 않음 점.
    static let notificationDot: CGFloat = 8
}
