import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

interface Props {
  name: string;
  memberNicknames: string[];
  /** 마지막 방문 이후 새 곡이 올라왔는가 — "새 기록" 배지 */
  hasNew?: boolean;
  onPress: () => void;
}

const MAX_AVATARS = 4;

/**
 * 온보딩의 참여 중인 팀 카드 (Figma 1:2138 "Button")
 * 보더형(radius 8) — 좌: 팀 이름 + [새 기록 · N명 참여중] / 우: 아바타 스택 + →
 */
export function TeamCard({ name, memberNicknames, hasNew, onPress }: Props) {
  const count = memberNicknames.length;
  const label = `${name}, ${hasNew ? '새 기록 있음, ' : ''}멤버 ${count}명`;

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
          <Text style={[typography.caption, styles.count]}>{count}명 참여중</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.avatars}>
          {memberNicknames.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m} nickname={m} size={size.avatarSm} overlap />
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
