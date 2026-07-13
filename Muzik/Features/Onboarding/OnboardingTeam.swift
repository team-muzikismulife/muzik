import Foundation

/// 온보딩 화면의 "참여 중인 팀" 카드 하나를 그리는 데 필요한 값.
struct OnboardingTeam: Identifiable, Hashable {
    let id: String
    let name: String
    /// 마지막 방문 이후 새 트랙이 올라왔는지 — "새 기록" 뱃지 노출 여부.
    let hasNewRecord: Bool
    let memberCount: Int
    /// 카드 우측 아바타 스택에 겹쳐 보여줄 멤버들. 시안 기준 최대 4명.
    let memberAvatars: [TeamMemberAvatar]
}

struct TeamMemberAvatar: Identifiable, Hashable {
    let id: String
    /// 에셋 카탈로그 이름. 비어 있으면 플레이스홀더 원을 그린다.
    let imageName: String?

    init(id: String = UUID().uuidString, imageName: String? = nil) {
        self.id = id
        self.imageName = imageName
    }
}
