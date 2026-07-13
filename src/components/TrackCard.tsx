import { Text, View, StyleSheet } from 'react-native';
import { colors, hitSlop, radius, size, spacing, typography } from '@/theme/tokens';
import type { Track } from '@/types/models';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { YoutubeArt } from './YoutubeArt';

interface Props {
  track: Track;
  /** 당일 + 본인 곡만 ⋯ 메뉴(수정/삭제) 노출 — 남의 곡엔 진입점이 아예 없다 */
  isMine?: boolean;
  onMore?: () => void;
}

/**
 * 멤버 곡 카드 (Figma 1:2209 "Container / music=true")
 * 카드 배경 = 곡 썸네일 + rgba(0,0,0,0.6) 오버레이. 앨범아트가 카드 그 자체다.
 * 헤더(아바타+닉네임) — gap 80 — 곡 정보 + 코멘트 박스(우측 ⋯)
 * 구버전(카드 #1E1E1E + 썸네일 80×80 + 수정/삭제 버튼 2개)에서 교체됨.
 */
export function TrackCard({ track, isMine, onMore }: Props) {
  const label = [`${track.nickname}님의 곡`, track.title, track.artist, track.comment]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.card} accessible accessibilityLabel={label}>
      {/* 앨범아트 배경 — videoId에서 파생한다. 별도 URL 필드를 받지 않으므로 곡과 어긋날 수 없다 */}
      <YoutubeArt videoId={track.videoId} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={styles.header}>
        <Avatar nickname={track.nickname} size={size.avatarMd} glow />
        <Text style={typography.body}>{track.nickname}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.titleCol}>
          <Text style={typography.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>

        <View style={styles.commentBox}>
          <Text style={[typography.caption, styles.commentText]} numberOfLines={2}>
            {track.comment || '한 줄 코멘트가 없어요'}
          </Text>
          {isMine && (
            <PressableScale
              onPress={onMore}
              hitSlop={hitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel="내 곡 수정 또는 삭제"
              style={styles.moreBtn}
            >
              <Icon name="more" size={size.icon} color={colors.text} />
            </PressableScale>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * 아직 곡을 올리지 않은 팀원의 카드 (Figma 1:2227 "Container / music=false")
 * 남의 카드도 자리를 차지한다 — 누가 아직 안 올렸는지 보이는 게 재촉 장치다(스펙 §2-C).
 * 다만 대신 올려줄 수는 없으므로 onPress가 없으면 비활성.
 */
export function AddTrackCard({
  nickname,
  onPress,
}: {
  nickname: string;
  onPress?: () => void;
}) {
  const isMine = !!onPress;
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <View style={styles.header}>
        <Avatar nickname={nickname} size={size.avatarMd} glow />
        <Text style={typography.body}>{nickname}</Text>
      </View>
      <PressableScale
        style={styles.addBox}
        onPress={onPress}
        disabled={!isMine}
        accessibilityRole={isMine ? 'button' : undefined}
        accessibilityLabel={
          isMine ? '오늘의 곡 추가하기' : `${nickname}님은 아직 곡을 올리지 않았어요`
        }
      >
        <Icon name="plus" size={size.icon} color={colors.text40} />
        <Text style={[typography.bodyMedium, styles.addText]}>곡 추가하기</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.xl,
    // 앨범아트가 라운드 밖으로 새지 않도록
    overflow: 'hidden',
    backgroundColor: colors.card,
    // Figma: 헤더와 곡 정보 사이 80 — 이 여백이 앨범아트를 드러낸다
    gap: spacing.art,
  },
  emptyCard: { gap: spacing.xl },
  overlay: { backgroundColor: colors.artOverlay },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  content: { gap: spacing.lg },
  titleCol: { gap: 2 },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white25,
    borderRadius: radius.thumb,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  commentText: { flex: 1, color: colors.text },
  moreBtn: { alignItems: 'center', justifyContent: 'center' },
  addBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: size.touch,
    paddingVertical: spacing.md,
    backgroundColor: colors.white1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.white20,
  },
  addText: { color: colors.text40 },
});
