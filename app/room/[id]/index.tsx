import { useCallback, useMemo } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, hitSlop, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { SkeletonTrackCard } from '@/components/Skeleton';
import { PressableScale } from '@/components/PressableScale';
import { Icon, IconButton } from '@/components/Icon';
import { DateTabs } from '@/components/DateTabs';
import { MissionBanner } from '@/components/MissionBanner';
import { TrackCard, AddTrackCard } from '@/components/TrackCard';
import { todayKey } from '@/lib/date';
import { themeFor } from '@/lib/themes';
import { useSessionStore } from '@/store/session';
import { useRoomStore } from '@/store/room';
import type { Member, Track } from '@/types/models';

/**
 * 메인 홈 (Figma 157:744) — 실데이터 구독 (M2)
 * 헤더([<] 팀 목록 + 팀 이름 / 알림) → 미션 스트립 → 날짜 탭 → 팀원별 곡 카드
 *
 * 카드는 팀원 수만큼 나열한다 — 미등록 팀원도 자리를 차지해 "누가 안 올렸는지"가 보인다.
 */
interface Row {
  member: Member;
  track: Track | null;
}

const LIST_CONTENT = {
  gap: spacing.lg,
  paddingHorizontal: spacing.xxl,
  paddingBottom: spacing.xxl,
};

export default function RoomHome() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myUid = useSessionStore((s) => s.uid);

  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const tracks = useRoomStore((s) => s.tracks);
  const days = useRoomStore((s) => s.days);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const subscribe = useRoomStore((s) => s.subscribe);

  const today = todayKey();
  // 날짜 탭 = 곡이 있는 날짜(days) + 오늘(아직 곡이 없어도 현재 화면이므로 항상 포함), 오름차순
  const dateKeys = useMemo(() => {
    const set = new Set(days.map((d) => d.dateKey));
    set.add(today);
    return [...set].sort();
  }, [days, today]);

  // 포커스 중에만 구독 — 이탈 시 unsubscribe (Firestore 읽기 비용 직결)
  useFocusEffect(useCallback(() => subscribe(id, today), [id, today, subscribe]));

  // 팀원 순서대로 한 줄씩 — 곡이 없으면 빈 카드 (렌더 중 계산, 파생 상태 금지)
  const rows: Row[] = members.map((member) => ({
    member,
    track: tracks.find((t) => t.uid === member.uid) ?? null,
  }));
  const doneToday = tracks.some((t) => t.uid === myUid);
  const teamName = room?.name ?? '';

  const openAddTrack = () => router.push(`/room/${id}/track/new`);

  if (status === 'error') {
    return (
      <Screen>
        <StateView
          status="error"
          title="팀을 불러오지 못했어요"
          message={error ?? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
          actionLabel="다시 시도"
          onAction={() => subscribe(id, today)}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <PressableScale
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={hitSlop.md}
            accessibilityRole="button"
            accessibilityLabel="팀 목록으로"
          >
            <Icon name="chevronLeft" size={size.iconLg} color={colors.text} />
          </PressableScale>
          <Text style={typography.title} numberOfLines={1}>
            {teamName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* 팀원·초대 코드 — 생성 이후에도 코드를 다시 보고 공유 */}
          <IconButton
            name="users"
            size={size.iconLg}
            accessibilityLabel="팀원·초대 코드"
            onPress={() => router.push(`/room/${id}/members`)}
          />
          {/* 알림 벨: 곡별 코멘트 기능 도입 후 활성화 (현재 비활성) */}
          <View style={styles.bell}>
            <IconButton name="bell" size={size.iconLg} accessibilityLabel="알림 (준비 중)" disabled />
            <View style={styles.dot} />
          </View>
        </View>
      </View>

      <MissionBanner mission={themeFor(today)} done={doneToday} onPress={openAddTrack} />

      <DateTabs
        dateKeys={dateKeys}
        selected={today}
        onSelect={(dk) => router.push(`/room/${id}/playlist/${dk}`)}
      />

      <FlatList
        data={status === 'loading' ? [] : rows}
        keyExtractor={(r) => r.member.uid}
        contentContainerStyle={LIST_CONTENT}
        ListEmptyComponent={
          status === 'loading' ? (
            <SkeletonTrackCard />
          ) : (
            <StateView
              status="empty"
              title="아직 팀원이 없어요"
              message="초대 코드를 공유해 팀원을 초대해 보세요."
            />
          )
        }
        renderItem={({ item }) => {
          const isMine = item.member.uid === myUid;
          if (item.track) {
            return <TrackCard track={item.track} isMine={isMine} onMore={openAddTrack} />;
          }
          return (
            <AddTrackCard
              nickname={item.member.nickname}
              onPress={isMine ? openAddTrack : undefined}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bell: { position: 'relative' },
  dot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: size.notifDot,
    height: size.notifDot,
    borderRadius: radius.full,
    backgroundColor: colors.notifDot,
  },
});
