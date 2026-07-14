import SwiftUI

/// 앨범 아트를 배경으로 깔고 그 위에 멤버·곡 정보·코멘트를 얹은 트랙 카드.
struct TrackCard: View {
    let track: PlaylistTrack
    var onTapMore: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: MuzikSpacing.trackCardGap) {
            PlaylistMemberRow(member: track.member, nameStyle: MuzikFont.memberName)

            VStack(alignment: .leading, spacing: MuzikSpacing.md) {
                songInfo
                commentBar
            }
        }
        .padding(MuzikSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(artwork)
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.largeCard))
    }

    private var songInfo: some View {
        VStack(alignment: .leading, spacing: MuzikSpacing.xxs) {
            Text(track.title)
                .muzikStyle(MuzikFont.trackTitle)
                .foregroundStyle(MuzikColor.textPrimary)
                .lineLimit(1)

            Text(track.artist)
                .muzikStyle(MuzikFont.caption)
                .foregroundStyle(MuzikColor.textMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var commentBar: some View {
        HStack(spacing: 0) {
            Text(track.comment)
                .muzikStyle(MuzikFont.caption)
                .foregroundStyle(MuzikColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: onTapMore) {
                Image(systemName: "ellipsis")
                    .font(.system(size: MuzikSize.icon, weight: .regular))
                    .foregroundStyle(MuzikColor.textPrimary)
                    .frame(width: MuzikSize.icon, height: MuzikSize.icon)
            }
            .buttonStyle(.plain)
        }
        .padding(.leading, MuzikSpacing.sm)
        .padding(.trailing, MuzikSpacing.s)
        .padding(.vertical, MuzikSpacing.s)
        .background(MuzikColor.commentBackground)
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.small))
    }

    /// 앨범 아트 위에는 글자가 묻히지 않게 막을 덮는다.
    /// 아트가 없을 땐 막까지 씌우면 배경색과 붙어버려 카드가 사라지므로 단색만 쓴다.
    @ViewBuilder
    private var artwork: some View {
        if let albumArtName = track.albumArtName {
            Image(albumArtName)
                .resizable()
                .scaledToFill()
                .overlay(MuzikColor.artworkScrim)
        } else {
            MuzikColor.artworkPlaceholder
        }
    }
}

/// 아직 오늘 곡을 올리지 않은 멤버에게 보이는 빈 카드.
struct AddTrackCard: View {
    let member: PlaylistMember
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MuzikSpacing.lg) {
            PlaylistMemberRow(member: member, nameStyle: MuzikFont.memberName)

            Button(action: action) {
                Text("+ 곡 추가하기")
                    .muzikStyle(MuzikFont.buttonLabel)
                    .foregroundStyle(MuzikColor.textDisabled)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MuzikSpacing.sm)
            }
            .buttonStyle(.plain)
            .background(MuzikColor.dashedFill)
            .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.small))
            .overlay {
                RoundedRectangle(cornerRadius: MuzikRadius.small)
                    .strokeBorder(
                        MuzikColor.dashedBorder,
                        style: StrokeStyle(lineWidth: MuzikBorder.hairline, dash: MuzikBorder.dashPattern)
                    )
            }
        }
        .padding(MuzikSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MuzikColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.largeCard))
    }
}

/// 카드 맨 위의 "아바타 + 멤버 이름" 줄.
private struct PlaylistMemberRow: View {
    let member: PlaylistMember
    let nameStyle: MuzikFont.Style

    var body: some View {
        HStack(spacing: MuzikSpacing.sm) {
            AvatarView(imageName: member.imageName, size: MuzikSize.profileAvatar)
                .shadow(color: .white.opacity(0.25), radius: 5)

            Text(member.name)
                .muzikStyle(nameStyle)
                .foregroundStyle(MuzikColor.textPrimary)
        }
        .frame(height: 40)
    }
}

#Preview {
    VStack(spacing: MuzikSpacing.md) {
        ForEach(PlaylistTrack.samples) { track in
            TrackCard(track: track)
        }
        AddTrackCard(member: PlaylistMember(id: "me", name: "규호")) {}
    }
    .padding(MuzikSpacing.xl)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(MuzikColor.background)
}
