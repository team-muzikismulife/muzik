import SwiftUI

/// 팀의 하루치 플레이리스트 화면.
/// Figma `playlist` 파일의 `App` 프레임(40:1574).
///
/// 시안에는 뒤로 가기가 없지만 온보딩에서 밀고 들어오는 화면이라
/// 헤더 왼쪽에 화살표를 하나 두어 되돌아갈 길을 만들었다.
struct TeamPlaylistView: View {
    let teamName: String
    let tracks: [PlaylistTrack]
    /// 오늘 아직 곡을 올리지 않은 나. 없으면 곡 추가 카드를 접는다.
    var pendingMember: PlaylistMember?
    /// 오늘의 추천 주제. 없으면 배너를 접는다.
    var recommendation: String?
    var hasUnreadNotification = true
    var onTapNotification: () -> Void = {}
    var onTapJoinRecommendation: () -> Void = {}
    var onTapAddTrack: () -> Void = {}
    var onTapTrackMore: (PlaylistTrack) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate = Date()

    var body: some View {
        VStack(spacing: 0) {
            header
            DateStrip(selectedDate: $selectedDate)

            ScrollView {
                VStack(spacing: MuzikSpacing.xl) {
                    if let recommendation {
                        RecommendationBanner(message: recommendation, action: onTapJoinRecommendation)
                    }

                    VStack(spacing: MuzikSpacing.md) {
                        ForEach(tracks) { track in
                            TrackCard(track: track) { onTapTrackMore(track) }
                        }

                        if let pendingMember {
                            AddTrackCard(member: pendingMember, action: onTapAddTrack)
                        }
                    }
                }
                .padding(.horizontal, MuzikSpacing.xl)
                .padding(.bottom, MuzikSpacing.xl)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MuzikColor.background)
        .toolbar(.hidden, for: .navigationBar)
    }

    private var header: some View {
        HStack(spacing: MuzikSpacing.s) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: MuzikSize.icon, weight: .regular))
                    .foregroundStyle(MuzikColor.textPrimary)
                    .frame(width: MuzikSize.icon, height: MuzikSize.icon)
            }
            .buttonStyle(.plain)

            Text("🎵 \(teamName)")
                .muzikStyle(MuzikFont.heading)
                .foregroundStyle(MuzikColor.textPrimary)
                .lineLimit(1)

            Spacer(minLength: MuzikSpacing.md)

            Button(action: onTapNotification) {
                Image(systemName: "bell")
                    .font(.system(size: MuzikSize.icon, weight: .regular))
                    .foregroundStyle(MuzikColor.textPrimary)
                    .frame(width: MuzikSize.headerIcon, height: MuzikSize.headerIcon)
                    .overlay(alignment: .topTrailing) {
                        if hasUnreadNotification {
                            Circle()
                                .fill(MuzikColor.notificationDot)
                                .frame(width: MuzikSize.notificationDot, height: MuzikSize.notificationDot)
                                .offset(x: MuzikSpacing.xs, y: -MuzikSpacing.xs)
                        }
                    }
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, MuzikSpacing.xl)
        .padding(.vertical, MuzikSpacing.lg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(MuzikColor.divider)
                .frame(height: MuzikBorder.hairline)
        }
    }
}

#Preview {
    NavigationStack {
        TeamPlaylistView(
            teamName: "무직은 내 삶",
            tracks: PlaylistTrack.samples,
            pendingMember: PlaylistMember(id: "me", name: "규호"),
            recommendation: "무더운 여름에 듣기 좋은 시원한 곡 추천하기"
        )
    }
}
