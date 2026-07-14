import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, opacity, size, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

interface Props {
  /** 오늘의 미션 텍스트 (themes.ts 풀에서 dateKey 해시로 결정) */
  mission: string;
  /** 오늘 곡을 이미 올렸는가 — 이미 올렸으면 스트립을 비활성화한다 */
  done: boolean;
  onPress: () => void;
}

/**
 * 오늘의 미션 배너 (Figma 1:1763 "ButtonRecommand")
 * 헤더 바로 아래 풀블리드 그라데이션 스트립. 스트립 전체가 곡 등록 진입점이다.
 * 구버전 카드형 배너(카운트다운 + [참여하기] CTA)에서 교체됨 — Figma 최신 이터레이션.
 */
export function MissionBanner({ mission, done, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={done}
      accessibilityRole="button"
      accessibilityLabel={
        done ? `오늘의 미션 완료: ${mission}` : `오늘의 미션: ${mission}. 눌러서 곡 추천하기`
      }
    >
      <LinearGradient
        colors={[colors.missionFrom, colors.missionTo]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.strip, done && { opacity: opacity.done }]}
      >
        <View style={styles.row}>
          <Text style={[typography.captionMedium, styles.text]} numberOfLines={2}>
            {done ? `오늘의 곡을 올렸어요 · ${mission}` : mission}
          </Text>
          {!done && <Icon name="arrowRight" size={size.iconLg} color={colors.text} />}
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.missionBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: size.missionStrip,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  text: { flex: 1 },
});
