import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type DimensionValue } from 'react-native';
import { colors, duration, opacity, radius, size, spacing } from '@/theme/tokens';

interface BlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
}

/** 로딩 중 레이아웃을 유지하는 회색 블록 (docs/design.md § Loading UI) */
export function Skeleton({ width = '100%', height = size.skeletonLine, borderRadius = radius.thumb }: BlockProps) {
  const pulse = useRef(new Animated.Value(opacity.done)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: duration.toast / 4, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: opacity.done, duration: duration.toast / 4, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius, backgroundColor: colors.skeleton, opacity: pulse }]}
    />
  );
}

/** 홈의 멤버 곡 카드 자리 — 실제 TrackCard와 같은 골격이라 로딩→데이터 전환이 튀지 않는다 */
export function SkeletonTrackCard() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton width={size.avatarMd} height={size.avatarMd} borderRadius={radius.full} />
        <Skeleton width={72} />
      </View>
      <View style={styles.trackRow}>
        <Skeleton width={size.thumbLg} height={size.thumbLg} />
        <View style={styles.trackText}>
          <Skeleton width="70%" />
          <Skeleton width="40%" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trackRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  trackText: { flex: 1, gap: spacing.sm, paddingTop: spacing.xs },
});
