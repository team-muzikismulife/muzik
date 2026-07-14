import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  /** 안전영역을 적용할 변. 헤더가 있는 화면은 top을 빼고, 히어로 풀블리드는 전부 뺀다. */
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/**
 * 모든 화면의 껍데기 (docs/design.md § Responsive)
 * 노치·홈 인디케이터를 숫자로 때우지 않는다 — insets로 처리한다.
 */
export function Screen({ children, edges = ['top', 'bottom'], style }: Props) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** 히어로가 상단을 풀블리드로 덮는 화면 — 안전영역은 콘텐츠가 직접 처리한다 */
export function BleedScreen({ children, style }: Omit<Props, 'edges'>) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
