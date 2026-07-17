import { useCallback } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { PressableScale } from '@/components/PressableScale';
import { IconButton } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { todayKey } from '@/lib/date';
import { inviteUrl, shareInvite } from '@/lib/invite';
import { useRoomStore } from '@/store/room';
import { toast } from '@/store/ui';
import type { Member } from '@/types/models';

/**
 * 팀원·초대 모달 (개선 1 — 방 생성 이후에도 코드를 다시 보고 재공유)
 * 초대 코드 카드(복사/공유) + 팀원 목록("오늘 곡 올림/아직" 뱃지).
 * 데이터는 room store 구독 — 홈이 모달로 가려지며 구독을 놓으므로 이 화면이 직접 구독한다.
 */
export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const today = todayKey();

  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const tracks = useRoomStore((s) => s.tracks);
  const status = useRoomStore((s) => s.status);
  const subscribe = useRoomStore((s) => s.subscribe);

  useFocusEffect(useCallback(() => subscribe(id, today), [id, today, subscribe]));

  const code = room?.inviteCode ?? '';
  const teamName = room?.name ?? '';
  const url = code ? inviteUrl(code) : null;

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    toast('초대 코드를 복사했어요');
  };

  const copyLink = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    toast('초대 링크를 복사했어요');
  };

  const share = async () => {
    if (!code) return;
    const result = await shareInvite(teamName, code);
    if (result === 'copied') toast('초대 내용을 복사했어요'); // 공유 시트가 없는 환경(데스크톱 웹)
  };

  const posted = (uid: string) => tracks.some((t) => t.uid === uid);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={typography.title} numberOfLines={1}>
          팀원 · 초대
        </Text>
        <IconButton name="close" size={size.iconLg} accessibilityLabel="닫기" onPress={() => router.back()} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.uid}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.invite}>
            <Text style={[typography.caption, styles.help]}>
              코드를 불러주거나, 초대 링크를 보내면 함께할 수 있어요.
            </Text>

            <View style={styles.codeBox}>
              <Text
                style={styles.code}
                accessibilityLabel={code ? `초대 코드 ${code.split('').join(' ')}` : '초대 코드 불러오는 중'}
              >
                {code || '••••••'}
              </Text>
            </View>

            {/* 초대 링크 — 브라우저에서 바로 열리는 https 주소 (muzik:// 딥링크는 웹에서 안 열린다) */}
            {!!url && (
              <Text
                style={[typography.tab, styles.link]}
                numberOfLines={1}
                selectable
                accessibilityLabel={`초대 링크 ${url}`}
              >
                {url}
              </Text>
            )}

            <View style={styles.row}>
              <PressableScale
                style={[styles.btn, styles.btnGhost]}
                onPress={copyCode}
                disabled={!code}
                accessibilityRole="button"
                accessibilityLabel="초대 코드 복사"
              >
                <Text style={typography.bodyMedium}>코드 복사</Text>
              </PressableScale>
              {!!url && (
                <PressableScale
                  style={[styles.btn, styles.btnGhost]}
                  onPress={copyLink}
                  accessibilityRole="button"
                  accessibilityLabel="초대 링크 복사"
                >
                  <Text style={typography.bodyMedium}>링크 복사</Text>
                </PressableScale>
              )}
              <PressableScale
                style={[styles.btn, styles.btnGhost]}
                onPress={share}
                disabled={!code}
                accessibilityRole="button"
                accessibilityLabel="초대 공유"
              >
                <Text style={typography.bodyMedium}>공유</Text>
              </PressableScale>
            </View>

            <Text style={[typography.caption, styles.sectionLabel]}>팀원 {members.length}명</Text>
          </View>
        }
        renderItem={({ item }: { item: Member }) => (
          <View
            style={styles.memberRow}
            accessible
            accessibilityLabel={`${item.nickname}, ${posted(item.uid) ? '오늘 곡 올림' : '아직 안 올림'}`}
          >
            <Avatar nickname={item.nickname} color={item.photoColor} size={size.avatarMd} />
            <Text style={[typography.body, styles.memberName]} numberOfLines={1}>
              {item.nickname}
            </Text>
            <Text style={[typography.tab, posted(item.uid) ? styles.done : styles.pending]}>
              {posted(item.uid) ? '오늘 곡 올림' : '아직'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          status === 'error' ? (
            <StateView status="error" title="팀원을 불러오지 못했어요" onAction={() => subscribe(id, today)} actionLabel="다시 시도" />
          ) : (
            <StateView status="loading" />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  list: { paddingBottom: spacing.xxl },
  invite: { gap: spacing.md, padding: spacing.xxl },
  help: { color: colors.text60 },
  codeBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.white20,
  },
  code: { ...typography.heroTitle, letterSpacing: 6 },
  link: { color: colors.text60, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.white10,
  },
  btnGhost: { backgroundColor: colors.white10 },
  sectionLabel: { marginTop: spacing.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  memberName: { flex: 1 },
  done: { color: colors.accent },
  pending: { color: colors.text40 },
});
