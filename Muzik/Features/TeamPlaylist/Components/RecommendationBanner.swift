import SwiftUI

/// 오늘의 추천 주제를 알리고 참여로 이끄는 그라데이션 배너.
struct RecommendationBanner: View {
    let message: String
    let action: () -> Void

    var body: some View {
        HStack(spacing: MuzikSpacing.md) {
            Text(message)
                .muzikStyle(MuzikFont.buttonLabel)
                .foregroundStyle(MuzikColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: action) {
                Text("참여하기")
                    .muzikStyle(MuzikFont.captionEmphasis)
                    .foregroundStyle(MuzikColor.textPrimary)
                    .padding(.horizontal, 15)
                    .padding(.vertical, MuzikSpacing.s)
            }
            .buttonStyle(.plain)
            .background(MuzikColor.bannerButtonBackground)
            .clipShape(Capsule())
        }
        .padding(MuzikSpacing.md)
        .background(
            LinearGradient(
                colors: [MuzikColor.bannerGradientStart, MuzikColor.bannerGradientEnd],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.largeCard))
        .overlay {
            RoundedRectangle(cornerRadius: MuzikRadius.largeCard)
                .strokeBorder(MuzikColor.bannerBorder, lineWidth: MuzikBorder.hairline)
        }
    }
}

#Preview {
    RecommendationBanner(message: "무더운 여름에 듣기 좋은 시원한 곡 추천하기") {}
        .padding(MuzikSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MuzikColor.background)
}
