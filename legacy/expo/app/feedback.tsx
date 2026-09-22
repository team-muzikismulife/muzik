import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { IconButton } from '@/components/Icon';
import { colors, size, spacing, typography, radius } from '@/theme/tokens';
import { reportTrack, submitFeedback } from '@/lib/api';
import { toMessage } from '@/lib/errors';

export default function Feedback() {
  const { roomId, trackId } = useLocalSearchParams<{ roomId?: string; trackId?: string }>();
  const router = useRouter();
  const report = !!roomId && !!trackId;
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState<'inappropriate' | 'copyright' | 'other'>('inappropriate');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [result, setResult] = useState('');
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (lock.current || done || (!report && !message.trim())) return;
    lock.current = true; setBusy(true);
    try {
      if (report) await reportTrack(roomId, trackId, reason);
      else await submitFeedback(message.trim());
      setDone(true); setResult('접수했어요. 운영자가 확인할게요.');
    } catch (e) { setResult(toMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen><ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <IconButton name="chevronLeft" accessibilityLabel="뒤로" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <Text style={typography.title}>{report ? '곡 신고' : '의견 보내기'}</Text>
    {report ? (['inappropriate', 'copyright', 'other'] as const).map((value, i) => <PressableScale key={value} style={styles.button} accessibilityRole="radio" accessibilityState={{ checked: reason === value }} onPress={() => setReason(value)}><Text style={typography.body}>{reason === value ? '● ' : '○ '}{['부적절한 내용', '저작권 문제', '기타'][i]}</Text></PressableScale>) : <>
      <Text style={typography.caption}>어떤 점이 불편했나요? 연락처 등 개인정보는 적지 말아 주세요.</Text>
      <TextInput accessibilityLabel="의견" value={message} onChangeText={setMessage} editable={!busy && !done} multiline maxLength={500} style={styles.input} />
    </>}
    <PressableScale accessibilityRole="button" accessibilityLabel="제출" style={styles.button} disabled={busy || done || (!report && !message.trim())} onPress={submit}>{busy ? <ActivityIndicator /> : <Text style={typography.body}>제출</Text>}</PressableScale>
    {!!result && <Text accessibilityRole="alert" style={typography.body}>{result}</Text>}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ body: { padding: spacing.xxl, gap: spacing.lg }, input: { ...typography.body, color: colors.text, backgroundColor: colors.white5, padding: spacing.lg, minHeight: size.player, borderRadius: radius.sm }, button: { minHeight: size.touch, padding: spacing.md, backgroundColor: colors.white10, borderRadius: radius.sm, justifyContent: 'center' } });
