import { KeyboardAvoidingView, Platform, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { IconButton } from '@/components/Icon';
import { TrackForm } from '@/components/TrackForm';
import { useSessionStore } from '@/store/session';
import { useRoomStore } from '@/store/room';

/**
 * 곡 등록 모달 (docs/곡등록설계.md §2 — presentation: 'modal')
 * _layout이 headerShown:false라 자체 닫기 헤더를 렌더한다.
 */
export default function NewTrack() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const uid = useSessionStore((s) => s.uid);
  const lastNickname = useSessionStore((s) => s.lastNickname);
  // 이 팀에서 내 닉네임 (members 문서). 없으면 마지막에 쓴 닉네임으로 폴백.
  const myMember = useRoomStore((s) => s.members.find((m) => m.uid === uid));
  const nickname = myMember?.nickname ?? lastNickname ?? '나';

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={typography.title}>오늘의 곡</Text>
          <IconButton
            name="close"
            size={size.iconLg}
            accessibilityLabel="닫기"
            onPress={() => router.back()}
          />
        </View>
        <TrackForm roomId={id} nickname={nickname} />
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
