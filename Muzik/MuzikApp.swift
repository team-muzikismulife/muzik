import SwiftUI

@main
struct MuzikApp: App {
    var body: some Scene {
        WindowGroup {
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
    }
}
