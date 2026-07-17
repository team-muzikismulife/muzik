import { ActivityIndicator, Text, TextInput, View, StyleSheet } from 'react-native';
import { aspect, colors, radius, size, spacing, typography } from '@/theme/tokens';
import { YoutubeArt } from './YoutubeArt';

interface Props {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** 확정된 videoId (썸네일 파생용) — ready일 때만 존재 */
  videoId: string | null;
  /** 편집 가능한 곡명/가수 (oEmbed·iTunes 초기값 → 사용자가 수정) */
  title: string;
  artist: string;
  onChangeTitle: (t: string) => void;
  onChangeArtist: (t: string) => void;
  titleError?: string | null;
  artistError?: string | null;
  errorText?: string;
}

const FIELD_MAX = 80;

/**
 * 등록 전 미리보기 카드 — "이 곡 맞아요?" (docs/곡등록설계.md §3)
 * 썸네일은 videoId에서 파생(YoutubeArt). 곡명·가수는 자동 추정값을 **편집 가능한 입력**으로 보여준다
 * (제목 파싱·iTunes 보정이 틀려도 한 탭에 고칠 수 있게).
 */
export function VideoPreview({
  status,
  videoId,
  title,
  artist,
  onChangeTitle,
  onChangeArtist,
  titleError,
  artistError,
  errorText,
}: Props) {
  if (status === 'idle') {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={typography.caption}>유튜브 링크를 붙여넣어 주세요</Text>
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={[styles.box, styles.center]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={[typography.caption, styles.err]}>{errorText ?? '불러오지 못했어요'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <YoutubeArt videoId={videoId!} style={styles.art} />
      <View style={styles.meta}>
        <Text style={[typography.caption, styles.fieldLabel]}>곡명</Text>
        <TextInput
          value={title}
          onChangeText={onChangeTitle}
          placeholder="곡 제목"
          placeholderTextColor={colors.text40}
          style={styles.input}
          maxLength={FIELD_MAX}
          accessibilityLabel="곡명 입력"
        />
        {!!titleError && <Text style={styles.fieldErr}>{titleError}</Text>}

        <Text style={[typography.caption, styles.fieldLabel]}>가수</Text>
        <TextInput
          value={artist}
          onChangeText={onChangeArtist}
          placeholder="가수"
          placeholderTextColor={colors.text40}
          style={styles.input}
          maxLength={FIELD_MAX}
          accessibilityLabel="가수 입력"
        />
        {!!artistError && <Text style={styles.fieldErr}>{artistError}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    aspectRatio: aspect.thumbnail,
    borderRadius: radius.card,
    backgroundColor: colors.white5,
    overflow: 'hidden',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.danger },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  art: { width: '100%', aspectRatio: aspect.thumbnail },
  meta: { gap: spacing.xs, padding: spacing.lg },
  fieldLabel: { marginTop: spacing.sm },
  fieldErr: { ...typography.caption, color: colors.danger },
  input: {
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: size.touch,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
});
