import { useCallback, useState } from 'react';
import { FlatList, Linking, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { IconButton } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { reviewQueue, moderateTrack, type ReviewItem } from '@/lib/api';
import { toMessage } from '@/lib/errors';
import { colors, spacing, typography, size } from '@/theme/tokens';

export default function Admin() {
  const router = useRouter();
  const [kind, setKind] = useState<'reports' | 'feedback' | 'events'>('reports');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { let active = true; setBusy(true); setError(''); reviewQueue(kind).then(r => { if (active) setItems(r.items); }).catch(e => { if (active) setError(toMessage(e)); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [kind]);
  useFocusEffect(load);
  const review = async (id: string, action: 'hide' | 'dismiss') => {
    if (busy) return;
    setBusy(true);
    try { await moderateTrack(id, action); setItems((await reviewQueue(kind)).items); }
    catch(e) { setError(toMessage(e)); } finally { setBusy(false); }
  };
  return <Screen><View style={styles.body}>
    <IconButton name="chevronLeft" accessibilityLabel="홈으로" onPress={() => router.replace('/')} />
    <Text style={typography.title}>운영 검토</Text>
    <View style={styles.tabs}>{(['reports','feedback','events'] as const).map((value, i) => <PressableScale key={value} accessibilityRole="tab" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={styles.button}><Text style={typography.body}>{['신고','의견','이벤트'][i]}</Text></PressableScale>)}</View>
    {error ? <StateView status="error" message={error} /> : <FlatList data={items} keyExtractor={i => i.id} ListEmptyComponent={<StateView status={busy ? 'loading' : 'empty'} />} renderItem={({ item }) => <View style={styles.item}>
      <Text style={typography.body}>{item.message ?? item.reason ?? item.name}</Text>
      {!!item.title && <Text style={typography.body}>{item.title}</Text>}
      {!!item.comment && <Text style={typography.body}>{item.comment}</Text>}
      {!!item.videoId && <IconButton name="play" accessibilityLabel="신고된 영상 확인" onPress={() => { Linking.openURL(`https://www.youtube.com/watch?v=${item.videoId}`).catch(() => setError('영상을 열지 못했어요.')); }} />}
      <Text style={typography.caption}>{item.roomId} {item.trackId} {item.status}</Text>
      {kind === 'reports' && item.status === 'open' && <View style={styles.tabs}>
        <PressableScale disabled={busy} style={styles.button} onPress={() => review(item.id, 'hide')}><Text style={typography.body}>전체에서 숨김</Text></PressableScale>
        <PressableScale disabled={busy} style={styles.button} onPress={() => review(item.id, 'dismiss')}><Text style={typography.body}>검토 완료</Text></PressableScale>
      </View>}
    </View>} />}
  </View></Screen>;
}
const styles = StyleSheet.create({ body: { flex: 1, padding: spacing.lg, gap: spacing.lg }, tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, button: { minHeight: size.touch, padding: spacing.sm, backgroundColor: colors.white10, justifyContent: 'center' }, item: { paddingVertical: spacing.lg, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider } });
