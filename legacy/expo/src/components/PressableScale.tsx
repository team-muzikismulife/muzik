import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { opacity } from '@/theme/tokens';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

/**
 * 눌림 피드백이 있는 Pressable (docs/design.md § Button)
 * 모바일엔 hover가 없다 — pressed 상태가 유일한 시각 피드백이므로 기본으로 깐다.
 * disabled면 자동으로 흐려지고 스크린리더에도 알린다.
 */
export function PressableScale({ style, disabled, accessibilityState, ...rest }: Props) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      style={({ pressed }) => [
        style,
        disabled && { opacity: opacity.disabled },
        pressed && !disabled && { opacity: opacity.pressed },
      ]}
      {...rest}
    />
  );
}
