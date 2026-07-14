import SwiftUI

/// 앱 진입 후 참여 중인 팀을 고르거나 새 팀을 만드는 온보딩 화면.
/// Figma `playlist` 파일의 `OnBoarding` 프레임(107:1126).
struct OnboardingView: View {
    let userName: String
    let teams: [OnboardingTeam]
    var profileImageName: String?
    var onSelectTeam: (OnboardingTeam) -> Void = { _ in }
    var onCreateTeam: () -> Void = {}
    var onTapProfile: () -> Void = {}

    /// 팀 카드를 누르면 그 팀이 쌓이고, 플레이리스트 화면이 밀려 들어온다.
    @State private var path: [OnboardingTeam] = []

    var body: some View {
        NavigationStack(path: $path) {
            content
                .navigationDestination(for: OnboardingTeam.self) { team in
                    TeamPlaylistView(
                        teamName: team.name,
                        tracks: PlaylistTrack.samples,
                        pendingMember: PlaylistMember(id: "me", name: userName),
                        recommendation: "무더운 여름에 듣기 좋은 시원한 곡 추천하기"
                    )
                }
                .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            header

            VStack(alignment: .leading, spacing: MuzikSpacing.xxl) {
                teamSection
                CreateTeamButton(action: onCreateTeam)
            }
            .padding(MuzikSpacing.xl)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MuzikColor.background)
    }

    private var header: some View {
        HStack {
            Text("환영합니다, \(userName)님")
                .muzikStyle(MuzikFont.heading)
                .foregroundStyle(MuzikColor.textPrimary)

            Spacer(minLength: MuzikSpacing.md)

            Button(action: onTapProfile) {
                AvatarView(imageName: profileImageName, size: MuzikSize.profileAvatar)
                    .shadow(color: .white.opacity(0.25), radius: 3.75)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, MuzikSpacing.xl)
        .padding(.top, MuzikSpacing.xl)
        .padding(.bottom, 25)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(MuzikColor.divider)
                .frame(height: MuzikBorder.hairline)
        }
    }

    private var teamSection: some View {
        VStack(alignment: .leading, spacing: MuzikSpacing.xl) {
            Text("참여 중인 팀")
                .muzikStyle(MuzikFont.sectionTitle)
                .foregroundStyle(MuzikColor.textPrimary)

            VStack(spacing: MuzikSpacing.md) {
                ForEach(teams) { team in
                    TeamCardButton(team: team) {
                        path.append(team)
                        onSelectTeam(team)
                    }
                }
            }
        }
    }
}

#Preview {
    OnboardingView(
        userName: "보규",
        teams: [
            OnboardingTeam(
                id: "1",
                name: "무직은 내 삶",
                hasNewRecord: true,
                memberCount: 3,
                memberAvatars: (0..<3).map { TeamMemberAvatar(id: "a\($0)") }
            ),
            OnboardingTeam(
                id: "2",
                name: "밴드 공연하자!",
                hasNewRecord: true,
                memberCount: 8,
                memberAvatars: (0..<4).map { TeamMemberAvatar(id: "b\($0)") }
            ),
            OnboardingTeam(
                id: "3",
                name: "안녕하세요미리내입니다잘부탁드립니다",
                hasNewRecord: false,
                memberCount: 7,
                memberAvatars: (0..<4).map { TeamMemberAvatar(id: "c\($0)") }
            )
        ]
    )
}
