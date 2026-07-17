import type { ReactNode } from 'react';
import { Platform, View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, size } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  /** 안전영역을 적용할 변. 헤더가 있는 화면은 top을 빼고, 히어로 풀블리드는 전부 뺀다. */
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/**
 * 모든 화면의 껍데기 (docs/design.md § Responsive)
 * 노치·홈 인디케이터를 숫자로 때우지 않는다 — insets로 처리한다.
 *
 * **웹 적응형**: 데스크톱에서 전체 폭으로 늘어나면 모바일 기준 비율이 깨지므로,
 * 웹에선 `size.appMaxWidth` 폭의 가운데 컬럼으로 제한한다(`frame`). 네이티브는 전체 폭.
 * 바깥 여백은 같은 bg라 이음매 없이 실기기와 동일한 비율로 보인다.
 */
export function Screen({ children, edges = ['top', 'bottom'], style }: Props) {
  return (
    <SafeAreaView style={[styles.root, styles.frame, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** 히어로가 상단을 풀블리드로 덮는 화면 — 안전영역은 콘텐츠가 직접 처리한다 */
export function BleedScreen({ children, style }: Omit<Props, 'edges'>) {
  return <View style={[styles.root, styles.frame, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // 웹에서만 폭 상한 + 가운데 정렬. 네이티브는 maxWidth undefined라 전체 폭 그대로.
  frame:
    Platform.OS === 'web'
      ? { width: '100%', maxWidth: size.appMaxWidth, alignSelf: 'center' }
      : {},
});
