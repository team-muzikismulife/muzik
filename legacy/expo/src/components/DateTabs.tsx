import { ScrollView, Text, StyleSheet } from 'react-native';
import { colors, fontScale, radius, size, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

interface Props {
  /** 'YYYY-MM-DD' 목록 (오름차순) */
  dateKeys: string[];
  selected: string;
  onSelect: (dateKey: string) => void;
}

/** 'YYYY-MM-DD' → 'M/D' */
export function tabLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 날짜 탭 (Figma 1:1773) — 좌우 chevron + 가로 스크롤 탭
 * dateKeys는 홈이 days 구독(곡이 있는 날짜) + 오늘로 구성해 넘긴다 (M4).
 */
export function DateTabs({ dateKeys, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* chevron은 스크롤 가능함을 알리는 어포던스 — 탭 대상이 아니므로 스크린리더에서 숨긴다 */}
      <Icon name="chevronLeft" size={size.icon} color={colors.text60} />

      {dateKeys.map((dk) => {
        const active = dk === selected;
        return (
          <PressableScale
            key={dk}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onSelect(dk)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${tabLabel(dk)} 플레이리스트`}
          >
            <Text
              style={[typography.tab, active && styles.tabTextActive]}
              maxFontSizeMultiplier={fontScale.tight}
            >
              {tabLabel(dk)}
            </Text>
          </PressableScale>
        );
      })}

      <Icon name="chevronRight" size={size.icon} color={colors.text60} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  tab: {
    minHeight: size.tabHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.white5,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.text },
  tabTextActive: { color: colors.bg },
});
