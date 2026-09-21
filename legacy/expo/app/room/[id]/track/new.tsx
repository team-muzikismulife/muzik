import { KeyboardAvoidingView, Platform, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/Icon';
import { TrackForm } from '@/components/TrackForm';
import { todayKey } from '@/lib/date';
import { useSessionStore } from '@/store/session';
import { useRoomStore } from '@/store/room';

/**
 * 곡 등록/수정 모달 (docs/곡등록설계.md §2 — presentation: 'modal')
 * _layout이 headerShown:false라 자체 닫기 헤더를 렌더한다.
 * 오늘 내 곡이 이미 있으면 **수정 모드**로 자동 전환한다(TrackForm 재사용).
 */
export default function NewTrack() {
  // url: 공유(Share Target)·딥링크로 넘어온 유튜브 링크 프리필용 (선택) — M5 준비
  const { id, url } = useLocalSearchParams<{ id: string; url?: string }>();
  const router = useRouter();
  const uid = useSessionStore((s) => s.uid);
  const lastNickname = useSessionStore((s) => s.lastNickname);
  // 이 팀에서 내 닉네임 (members 문서). 없으면 마지막에 쓴 닉네임으로 폴백.
  const myMember = useRoomStore((s) => s.members.find((m) => m.uid === uid));
  const nickname = myMember?.nickname ?? lastNickname ?? '나';
  // 오늘 내가 올린 곡 — 있으면 수정 모드. dateKey로 한 번 더 좁혀 지난 날짜 오작동을 막는다.
  const today = todayKey();
  const myTrack = useRoomStore((s) => s.tracks.find((t) => t.uid === uid && t.dateKey === today));

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={typography.title}>{myTrack ? '오늘의 곡 수정' : '오늘의 곡'}</Text>
          <IconButton
            name="close"
            size={size.iconLg}
            accessibilityLabel="닫기"
            onPress={() => router.back()}
          />
        </View>
        <TrackForm roomId={id} nickname={nickname} initialUrl={url} editTrack={myTrack} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xxl,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
});
