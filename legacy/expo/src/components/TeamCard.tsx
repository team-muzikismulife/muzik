import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import type { Member } from '@/types/models';

/** 아바타 스택에 필요한 만큼만 — 멤버 전체를 읽지 않는다 */
export type TeamCardMember = Pick<Member, 'uid' | 'nickname' | 'photoColor'>;

interface Props {
  name: string;
  /**
   * 인원수는 rooms.memberCount가 진실이다.
   * `members`는 아바타용 일부(최대 4명)라 length로 세면 8명 팀이 "4명"이 된다.
   */
  memberCount: number;
  members: TeamCardMember[];
  /** 마지막 방문 이후 새 곡이 올라왔는가 — "새 기록" 배지 (TODO(M2): rooms.lastTrackAt) */
  hasNew?: boolean;
  onPress: () => void;
}

/**
 * 온보딩의 참여 중인 팀 카드 (Figma 107:1126)
 * 보더형(radius 8) — 좌: 팀 이름 + [새 기록 · N명 참여중] / 우: 아바타 스택 + →
 */
export function TeamCard({ name, memberCount, members, hasNew, onPress }: Props) {
  const label = `${name}, ${hasNew ? '새 기록 있음, ' : ''}멤버 ${memberCount}명`;

  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.info}>
        {/* 긴 팀 이름은 말줄임 — Figma가 "안녕하세요미리내입니다잘부탁드립니다"로 검증한 케이스 */}
        <Text style={typography.bodySemibold} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          {hasNew && (
            <>
              <Text style={[typography.captionMedium, styles.newBadge]}>새 기록</Text>
              <Text style={[typography.caption, styles.dot]}>·</Text>
            </>
          )}
          <Text style={[typography.caption, styles.count]}>{memberCount}명 참여중</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.avatars}>
          {members.map((m) => (
            // photoColor는 서버가 확정한 색 — 기기가 달라도 같은 사람은 같은 색이다
            <Avatar
              key={m.uid}
              nickname={m.nickname}
              color={m.photoColor}
              size={size.avatarSm}
              overlap
            />
          ))}
        </View>
        <Icon name="arrowRight" size={size.icon} color={colors.text} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.white60,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  info: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newBadge: { color: colors.accent },
  dot: { color: colors.text50 },
  count: { color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatars: { flexDirection: 'row' },
});
