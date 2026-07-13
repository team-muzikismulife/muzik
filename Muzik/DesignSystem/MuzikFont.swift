import SwiftUI

/// Figma `playlist` 파일의 타이포그래피 토큰.
///
/// 시안은 Pretendard를 쓴다. 타겟에 폰트 파일이 번들되고 Info.plist의
/// `UIAppFonts`에 등록되기 전까지는 SwiftUI가 시스템 폰트로 대체해 렌더링한다.
enum MuzikFont {
    /// 크기·자간·행간을 한 묶음으로 나르는 텍스트 스펙. `.muzikStyle(_:)`로 적용한다.
    struct Style {
        let weight: Weight
        let size: CGFloat
        let tracking: CGFloat

        /// 시안의 모든 텍스트가 line-height 1.4다.
        var lineSpacing: CGFloat { size * 0.4 }
        var font: Font { .custom(weight.postScriptName, size: size) }
    }

    enum Weight {
        case regular, medium, semiBold

        var postScriptName: String {
            switch self {
            case .regular: return "Pretendard-Regular"
            case .medium: return "Pretendard-Medium"
            case .semiBold: return "Pretendard-SemiBold"
            }
        }
    }

    /// "환영합니다, 보규님"
    static let heading = Style(weight: .medium, size: 20, tracking: -0.08)
    /// "참여 중인 팀" — 시안에서 유일하게 자간이 양수다.
    static let sectionTitle = Style(weight: .medium, size: 16, tracking: 0.064)
    /// 팀 이름
    static let teamName = Style(weight: .semiBold, size: 16, tracking: -0.064)
    /// "새로운 팀 개설하기"
    static let buttonLabel = Style(weight: .medium, size: 16, tracking: -0.064)
    /// "새 기록"
    static let captionEmphasis = Style(weight: .medium, size: 14, tracking: -0.056)
    /// "3명 참여중", 가운뎃점
    static let caption = Style(weight: .regular, size: 14, tracking: -0.056)
}

extension View {
    func muzikStyle(_ style: MuzikFont.Style) -> some View {
        font(style.font)
            .tracking(style.tracking)
            .lineSpacing(style.lineSpacing)
    }
}
