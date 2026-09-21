import { Linking, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { IconButton } from './Icon';
import { colors, spacing, typography } from '@/theme/tokens';
import type { Track } from '@/types/models';
import { trackKey, useHiddenTracks } from '@/store/hiddenTracks';
import { toast } from '@/store/ui';

export function TrackActions({ roomId, track }: { roomId: string; track: Track }) {
  const router = useRouter();
  const hide = useHiddenTracks(s => s.hide);
  if (track.hidden) return <Text style={typography.caption}>운영 검토로 숨긴 곡이에요</Text>;
  return <View style={styles.row}>
    <IconButton name="play" accessibilityLabel={`${track.title} 유튜브에서 개별 재생`} onPress={() => {
      Linking.openURL(`https://www.youtube.com/watch?v=${track.videoId}`).catch(() => toast('유튜브를 열지 못했어요. 다시 시도해 주세요.'));
    }} />
    <IconButton name="close" accessibilityLabel="이 곡 내 화면에서 숨기기" onPress={() => { hide(trackKey(roomId, track)); toast('이 브라우저에서 숨겼어요. 홈에서 다시 표시할 수 있어요.'); }} />
    <IconButton name="more" accessibilityLabel="곡 신고하기" onPress={() => router.push({ pathname: '/feedback', params: { roomId, trackId: `${track.uid}_${track.dateKey}` } })} />
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, backgroundColor: colors.bg } });
