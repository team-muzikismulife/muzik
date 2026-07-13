import SwiftUI

/// 원형 프로필 이미지. 에셋 이름이 없으면 플레이스홀더 원을 그린다.
struct AvatarView: View {
    let imageName: String?
    let size: CGFloat

    var body: some View {
        Group {
            if let imageName {
                Image(imageName)
                    .resizable()
                    .scaledToFill()
            } else {
                Circle().fill(MuzikColor.avatarPlaceholder)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

/// 팀 카드 우측에 겹쳐 놓이는 멤버 아바타 묶음.
///
/// 뒤에 오는 아바타가 위로 올라오면서 왼쪽으로 그림자를 떨어뜨린다 —
/// HStack의 기본 그리기 순서가 시안의 z-순서와 같아 그대로 둔다.
struct MemberAvatarStack: View {
    let avatars: [TeamMemberAvatar]

    var body: some View {
        HStack(spacing: -MuzikSize.memberAvatarOverlap) {
            ForEach(avatars) { avatar in
                AvatarView(imageName: avatar.imageName, size: MuzikSize.memberAvatar)
                    .shadow(color: .black.opacity(0.4), radius: 2.4, x: -4.8, y: 0)
            }
        }
    }
}

#Preview {
    MemberAvatarStack(avatars: (0..<4).map { TeamMemberAvatar(id: "\($0)") })
        .padding()
        .background(MuzikColor.background)
}
