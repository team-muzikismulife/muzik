import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { PressableScale } from './PressableScale';

type Status = 'loading' | 'empty' | 'error';

interface Props {
  status: Status;
  /** empty·error에서 보여줄 제목 */
  title?: string;
  /** 보조 설명 — 사용자가 다음에 뭘 할 수 있는지 알려준다 */
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const DEFAULTS: Record<Status, { title: string; message: string }> = {
  loading: { title: '', message: '' },
  empty: { title: '아직 아무것도 없어요', message: '' },
  error: { title: '문제가 발생했어요', message: '잠시 후 다시 시도해 주세요.' },
};

/**
 * 로딩 / 빈 상태 / 에러를 한 컴포넌트로 통일한다 (docs/frontend.md § 4상태)
 * "에러가 발생했습니다"로 끝내지 않는다 — 항상 다음 행동(actionLabel)을 준다.
 */
export function StateView({ status, title, message, actionLabel, onAction }: Props) {
  if (status === 'loading') {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.text} accessibilityLabel="불러오는 중" />
      </View>
    );
  }

  const text = {
    title: title ?? DEFAULTS[status].title,
    message: message ?? DEFAULTS[status].message,
  };

  return (
    <View
      style={styles.root}
      accessibilityRole={status === 'error' ? 'alert' : undefined}
      accessibilityLabel={`${text.title}. ${text.message}`}
    >
      <Text style={[typography.bodyMedium, styles.center]}>{text.title}</Text>
      {!!text.message && <Text style={[typography.caption, styles.center]}>{text.message}</Text>}
      {!!actionLabel && !!onAction && (
        <PressableScale
          style={styles.action}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={typography.captionMedium}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xxl,
  },
  center: { textAlign: 'center' },
  action: {
    marginTop: spacing.sm,
    minHeight: size.ctaSm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white10,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
});
