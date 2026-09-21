import { useCallback } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { TeamCard } from '@/components/TeamCard';
import { TrackCard } from '@/components/TrackCard';
import { getMockRoomState } from '@/lib/mockData';
import { todayKey } from '@/lib/date';
import { useSessionStore } from '@/store/session';
import { useTeamsStore } from '@/store/teams';
import { useHiddenTracks } from '@/store/hiddenTracks';
import { recordVisit } from '@/lib/api';
import { isMockPreviewEnabled } from '@/lib/mockPreview';

/**
 * 온보딩 / 참여 중인 팀 (Figma 107:1126 "OnBoarding")
 *
 * 입장 경로 둘: 초대 링크(`/r/{code}`) + **코드 직접 입력(`/room/join`)**.
 * 딥링크가 웹·Expo Go에서 안 열리므로 코드 입력이 실질적 기본 입장 경로다.
 */

// Figma: 카드 간 16, 목록과 개설 버튼 사이 32
const LIST_CONTENT = { gap: spacing.lg, paddingBottom: spacing.lg };

export default function Onboarding() {
  const router = useRouter();
  const hidden = useHiddenTracks(s => s.keys);
  const restore = useHiddenTracks(s => s.restore);

  const uid = useSessionStore((s) => s.uid);
  const lastNickname = useSessionStore((s) => s.lastNickname);

  const teams = useTeamsStore((s) => s.teams);
  const teamsStatus = useTeamsStore((s) => s.status);
  const teamsError = useTeamsStore((s) => s.error);
  const loadTeams = useTeamsStore((s) => s.load);

  // 포커스 중에만 조회한다 — 팀 개설·입장 후 돌아오면 목록이 갱신된다
  useFocusEffect(
    useCallback(() => {
      if (uid) {
        loadTeams(uid);
        if (!isMockPreviewEnabled()) recordVisit().catch(() => {});
      }
    }, [uid, loadTeams]),
  );

  return (
    <Screen>
      {/* 헤더 — 인사말 + 내 프로필. 아직 어느 팀에도 안 들어갔으면 닉네임이 없다 */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <View style={styles.brandMark}>
            <Icon name="music" size={size.icon} color={colors.text} />
          </View>
          <View style={styles.headerText}>
            <Text style={typography.title} numberOfLines={1}>
              무직은 내 삶
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              환영합니다{lastNickname ? `, ${lastNickname}님` : ''}
            </Text>
          </View>
        </View>
        {!!lastNickname && <Avatar nickname={lastNickname} size={size.avatarMd} glow />}
      </View>

      <View style={styles.body}>
        <View style={styles.sectionHeader}>
          <Text style={typography.bodyMedium}>참여 중인 팀</Text>
          {teamsStatus === 'ready' && teams.length > 0 && (
            <Text style={typography.caption}>{teams.length}개</Text>
          )}
        </View>

        <FlatList
          ListHeaderComponent={<View style={styles.footer}>
            <Text style={typography.title}>{'우리 모임이 하루 한 곡씩\n만드는 플레이리스트'}</Text>
            <Text style={typography.caption}>유튜브 곡을 골라 나누고, 날짜별로 함께 들어요.</Text>
            <Text style={typography.caption}>같은 브라우저로 돌아오면 참여한 팀이 복원돼요. 기기를 바꾸거나 브라우저 데이터를 지우면 기존 계정을 복구할 수 없어요.</Text>
            {isMockPreviewEnabled() && <Text style={typography.caption}>발표용 시연 · 데이터는 저장되지 않아요</Text>}
          </View>}
          data={teamsStatus === 'ready' ? teams : []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={LIST_CONTENT}
          ListEmptyComponent={
            teamsStatus === 'loading' ? (
              <StateView status="loading" compact />
            ) : teamsStatus === 'error' ? (
              <StateView
                status="error"
                title="팀 목록을 불러오지 못했어요"
                message={teamsError ?? undefined}
                actionLabel="다시 시도"
                onAction={() => uid && loadTeams(uid)}
                compact
              />
            ) : (
              // 신규 사용자가 가장 먼저 보는 화면이다 — 다음 행동(개설·입장)으로 이어줘야 한다
              <StateView
                status="empty"
                title="참여 중인 팀이 없어요"
                message="팀을 만들거나, 받은 코드로 입장해 보세요."
                compact
              />
            )
          }
          renderItem={({ item }) => (
            <TeamCard
              name={item.name}
              memberCount={item.memberCount}
              members={item.members}
              onPress={() => router.push(`/room/${item.id}`)}
            />
          )}
          // Figma: 팀 목록 바로 아래 (gap 32) — 화면 하단에 밀어두지 않는다
          ListFooterComponent={
            <View style={styles.footer}>
              {/* 초대 코드로 참가 — 링크보다 확실한 기본 입장 경로 */}
              <PressableScale
                style={styles.joinBtn}
                onPress={() => router.push('/room/join')}
                accessibilityRole="button"
                accessibilityLabel="팀 참가하기"
              >
                <Icon name="arrowRight" size={size.icon} color={colors.bg} />
                <Text style={[typography.bodyMedium, styles.onPrimary]}>팀 참가하기</Text>
              </PressableScale>

              <PressableScale
                style={styles.createBtn}
                onPress={() => router.push('/room/create')}
                accessibilityRole="button"
                accessibilityLabel="새로운 팀 개설하기"
              >
                <Icon name="plus" size={size.icon} color={colors.text} />
                <Text style={typography.bodyMedium}>새로운 팀 개설하기</Text>
              </PressableScale>
              {teamsStatus === 'ready' && teams.length === 0 && <View style={styles.footer}>
                <Text style={typography.caption}>하루 한 곡, 이렇게 모여요 · 예시</Text>
                <TrackCard track={{ ...getMockRoomState(todayKey()).tracks[0], nickname: '멤버' }} />
              </View>}
              <PressableScale style={styles.createBtn} accessibilityRole="button" onPress={() => router.push('/feedback')}><Icon name="more" size={size.icon} /><Text style={typography.body}>의견 보내기</Text></PressableScale>
              {hidden.length > 0 && <PressableScale style={styles.createBtn} accessibilityRole="button" onPress={restore}><Text style={typography.body}>내가 숨긴 곡 다시 표시</Text></PressableScale>}
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandMark: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.full,
    backgroundColor: colors.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  body: { flex: 1, gap: spacing.xxl, padding: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { gap: spacing.md, marginTop: spacing.lg },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: size.touch,
    paddingVertical: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.sm,
  },
  onPrimary: { color: colors.bg },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: size.touch,
    paddingVertical: spacing.md,
    backgroundColor: colors.white3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.white20,
  },
});
