import SwiftUI

/// "참여 중인 팀" 목록의 카드 한 장.
struct TeamCardButton: View {
    let team: OnboardingTeam
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: MuzikSpacing.lg) {
                VStack(alignment: .leading, spacing: MuzikSpacing.xs) {
                    Text(team.name)
                        .muzikStyle(MuzikFont.teamName)
                        .foregroundStyle(MuzikColor.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    subtitle
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: MuzikSpacing.sm) {
                    MemberAvatarStack(avatars: team.memberAvatars)

                    Image(systemName: "arrow.right")
                        .font(.system(size: MuzikSize.icon, weight: .regular))
                        .foregroundStyle(MuzikColor.textPrimary)
                        .frame(width: MuzikSize.icon, height: MuzikSize.icon)
                }
            }
            .padding(MuzikSpacing.md)
        }
        .buttonStyle(.plain)
        .background(MuzikColor.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.card))
        .overlay {
            RoundedRectangle(cornerRadius: MuzikRadius.card)
                .strokeBorder(MuzikColor.cardBorder, lineWidth: MuzikBorder.hairline)
        }
    }

    /// "새 기록 · 3명 참여중" — 새 기록이 없으면 참여 인원만 남는다.
    private var subtitle: some View {
        HStack(spacing: MuzikSpacing.xs) {
            if team.hasNewRecord {
                Text("새 기록")
                    .muzikStyle(MuzikFont.captionEmphasis)
                    .foregroundStyle(MuzikColor.accent)

                Text("·")
                    .muzikStyle(MuzikFont.caption)
                    .foregroundStyle(MuzikColor.textTertiary)
            }

            Text("\(team.memberCount)명 참여중")
                .muzikStyle(MuzikFont.caption)
                .foregroundStyle(MuzikColor.textSecondary)
        }
    }
}

/// 점선 테두리의 "새로운 팀 개설하기" 버튼.
struct CreateTeamButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: MuzikSpacing.xs) {
                Image(systemName: "plus")
                    .font(.system(size: MuzikSize.icon, weight: .regular))
                    .frame(width: MuzikSize.icon, height: MuzikSize.icon)

                Text("새로운 팀 개설하기")
                    .muzikStyle(MuzikFont.buttonLabel)
            }
            .foregroundStyle(MuzikColor.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, MuzikSpacing.sm)
        }
        .buttonStyle(.plain)
        .background(MuzikColor.dashedFill)
        .clipShape(RoundedRectangle(cornerRadius: MuzikRadius.card))
        .overlay {
            RoundedRectangle(cornerRadius: MuzikRadius.card)
                .strokeBorder(
                    MuzikColor.dashedBorder,
                    style: StrokeStyle(lineWidth: MuzikBorder.hairline, dash: MuzikBorder.dashPattern)
                )
        }
    }
}
