import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { aspect, colors, radius, spacing, typography } from '@/theme/tokens';
import { YoutubeArt } from './YoutubeArt';

export interface VideoMetaPreview {
  videoId: string;
  title: string;
  artist: string;
}

interface Props {
  status: 'idle' | 'loading' | 'ready' | 'error';
  meta: VideoMetaPreview | null;
  errorText?: string;
}

/**
 * 등록 전 미리보기 카드 — "이 곡 맞아요?"를 보여준다 (docs/곡등록설계.md §3)
 * 썸네일은 videoId에서 파생(YoutubeArt), 제목·채널명은 oEmbed.
 */
export function VideoPreview({ status, meta, errorText }: Props) {
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
    <View style={styles.card} accessible accessibilityLabel={`선택된 곡: ${meta?.title}, ${meta?.artist}`}>
      <YoutubeArt videoId={meta!.videoId} style={styles.art} />
      <View style={styles.meta}>
        <Text style={typography.bodyMedium} numberOfLines={2}>
          {meta!.title}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {meta!.artist}
        </Text>
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
});
