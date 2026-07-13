import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, duration, radius, shadow, spacing, typography, zIndex } from '@/theme/tokens';
import { useUiStore } from '@/store/ui';

/**
 * 실패·안내의 단일 채널 (docs/frontend.md § Error Handling — alert() 금지)
 * 루트 레이아웃에 한 번만 마운트한다.
 */
export function Toast() {
  const message = useUiStore((s) => s.message);
  const seq = useUiStore((s) => s.seq);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: message ? 1 : 0,
      duration: duration.fast,
      useNativeDriver: true,
    }).start();
  }, [message, seq, anim]);

  if (!message) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.toast,
        { bottom: insets.bottom + spacing.xxl },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [spacing.md, 0] }) }] },
      ]}
    >
      <Text style={[typography.caption, styles.text]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    zIndex: zIndex.toast,
    backgroundColor: colors.toastBg,
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.toast,
  },
  text: { color: colors.text, textAlign: 'center' },
});
