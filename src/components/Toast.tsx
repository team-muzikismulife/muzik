import { useEffect, useRef, useState } from 'react';
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
  // 페이드아웃이 끝난 뒤에 언마운트한다 — message가 null이 되는 즉시 return하면 사라짐 애니메이션이 안 보인다
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (message) setShown(message);
    Animated.timing(anim, {
      toValue: message ? 1 : 0,
      duration: duration.fast,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 도중에 새 메시지가 들어오면 finished=false → 유지
      if (finished && !message) setShown(null);
    });
  }, [message, seq, anim]);

  if (!shown) return null;

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
      <Text style={[typography.caption, styles.text]}>{shown}</Text>
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
