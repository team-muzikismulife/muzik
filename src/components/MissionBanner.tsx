import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontScale, radius, size, spacing, typography } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

interface Props {
  /** 오늘의 미션 텍스트 (themes.ts 풀에서 dateKey 해시로 결정) */
  mission: string;
  /** 오늘 곡을 이미 올렸는가 — 문구만 완료 상태로 바꾼다 */
  done: boolean;
  onPress: () => void;
  actionLabel?: string;
}

/**
 * 오늘의 미션 배너 (Figma 1:1763 "ButtonRecommand")
 * 날짜 탭 아래 둥근 그라데이션 카드. 카드 전체가 해당 날짜 플레이리스트 진입점이다.
 */
export function MissionBanner({ mission, done, onPress, actionLabel = '플레이리스트 열기' }: Props) {
  return (
    <View style={styles.container}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          done
            ? `오늘의 미션 완료: ${mission}. 눌러서 ${actionLabel}`
            : `오늘의 미션: ${mission}. 눌러서 ${actionLabel}`
        }
      >
        <LinearGradient
          colors={[colors.missionFrom, colors.missionTo]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.card}
        >
          <Text style={[typography.captionMedium, styles.text]} numberOfLines={2}>
            {done ? `오늘의 곡을 올렸어요 · ${mission}` : mission}
          </Text>
          <View style={styles.cta}>
            <Text
              style={[typography.captionMedium, styles.ctaText]}
              maxFontSizeMultiplier={fontScale.tight}
            >
              모아듣기
            </Text>
          </View>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  card: {
    minHeight: size.missionStrip,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.missionBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  text: { flex: 1 },
  cta: {
    minWidth: 80,
    minHeight: size.ctaSm,
    borderRadius: radius.full,
    backgroundColor: colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  ctaText: { color: colors.text },
});
