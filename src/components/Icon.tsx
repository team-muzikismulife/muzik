import Feather from '@expo/vector-icons/Feather';
import { colors, hitSlop, radius, size } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/** Figma 아이콘 → Feather 매핑 (이모지 대신 벡터) */
export const ICONS = {
  arrowRight: 'arrow-right',
  chevronLeft: 'chevron-left',
  chevronRight: 'chevron-right',
  chevronDown: 'chevron-down',
  plus: 'plus',
  more: 'more-horizontal', // ri:more-line — 코멘트 박스의 ⋯
  bell: 'bell',
  users: 'users',
  share: 'share',
  play: 'play',
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size: s = size.icon, color = colors.text }: IconProps) {
  // 아이콘은 항상 장식용 — 의미는 부모(IconButton 등)의 accessibilityLabel이 전달한다.
  // 스크린리더에서 글리프가 무의미한 문자로 읽히지 않도록 숨긴다 (Avatar와 동일 규칙).
  return (
    <Feather
      name={ICONS[name]}
      size={s}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

interface IconButtonProps extends IconProps {
  /**
   * 필수 — 아이콘은 스크린리더에 아무 의미도 전달하지 않는다.
   * 타입 시스템으로 접근성을 강제한다 (docs/design.md § Accessibility)
   */
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  /** 반투명 검정 원형 (히어로 위 버튼) */
  variant?: 'plain' | 'circle';
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  name,
  size: s,
  color,
  accessibilityLabel,
  onPress,
  disabled,
  variant = 'plain',
  style,
}: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop.sm}
      style={[styles.base, variant === 'circle' && styles.circle, style]}
    >
      <Icon name={name} size={s} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 44pt — iOS HIG 최소 터치 타깃
  base: {
    minWidth: size.touch,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.full,
    backgroundColor: colors.black40,
  },
});
