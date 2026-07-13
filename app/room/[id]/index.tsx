import { useState } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
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
import type { Track } from '@/types/models';

/**
 * 메인 홈 (Figma 1:1732 "Main")
 * 헤더(팀 이름 + chevron + 알림) → 미션 스트립 → 날짜 탭 → 팀원별 곡 카드
 *
 * 카드는 **팀원 수만큼** 나열한다 (스펙 §2-C). 미등록 팀원도 자리를 차지하므로
 * "누가 아직 안 올렸는지"가 한눈에 보인다 — 이게 재촉 장치다.
 *
 * TODO(M2): MOCK 제거 → useFocusEffect + onSnapshot(tracks/members/days)
 */
interface Member {
  uid: string;
  nickname: string;
}

const MOCK_MEMBERS: Member[] = [
  { uid: 'u1', nickname: '보규' },
  { uid: 'u2', nickname: '승완' },
  { uid: 'u3', nickname: '규호' },
];

/**
 * 목업도 **실제 videoId의 실제 메타데이터**여야 한다.
 * 예전 목업은 videoId와 무관한 제목·아티스트를 손으로 적어서, 카드 배경(videoId 파생)과
 * 텍스트가 서로 다른 곡을 가리키고 있었다. 지어내지 말 것.
 */
const MOCK_TRACKS: Track[] = [
  {
    videoId: 'pM86f0NAsCY', // 백예린 '1-4-3' Lyric Video
    title: '1-4-3',
    artist: 'Yerin Baek',
    comment: '1-4-3의 의미는 I LOVE YOU',
    uid: 'u1',
    nickname: '보규',
    dateKey: todayKey(),
    order: 1,
    createdAt: Date.now(),
    embeddable: true,
    durationSec: 218,
    metaRefreshedAt: Date.now(),
  },
  {
    videoId: 'JaIMSzE5yLA', // 실리카겔 'NO PAIN' M/V
    title: 'NO PAIN',
    artist: 'Silica Gel 실리카겔',
    comment: '',
    uid: 'u3',
    nickname: '규호',
    dateKey: todayKey(),
    order: 2,
    createdAt: Date.now(),
    embeddable: true,
    durationSec: 254,
    metaRefreshedAt: Date.now(),
  },
];

const DAY_MS = 86_400_000;
const TAB_COUNT = 7;

/**
 * 날짜 탭 — 라벨과 이동 대상 dateKey가 반드시 일치해야 한다.
 * TODO(M4): days 컬렉션 구독으로 교체 — 실제 곡이 있는 날짜만 뜬다.
 */
function recentDateKeys(): string[] {
  const now = Date.now();
  return Array.from({ length: TAB_COUNT }, (_, i) =>
    todayKey(new Date(now - (TAB_COUNT - 1 - i) * DAY_MS)),
  );
}

type Status = 'loading' | 'ready' | 'empty' | 'error';

/** 팀원 한 명의 오늘 현황 — 곡을 올렸거나(track), 아직 안 올렸거나(null) */
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

  // TODO(M1): session.uid / session.nickname 으로 교체
  const myUid = 'u2';
  // TODO(M1): rooms/{id}.name 으로 교체
  const teamName = '🎵 무직은 내 삶';

  // TODO(M2): room store의 구독 상태로 교체
  const [status, setStatus] = useState<Status>('ready');

  const today = todayKey();
  const dateKeys = recentDateKeys();
  const tracks = status === 'empty' ? [] : MOCK_TRACKS;

  // 팀원 순서대로 한 줄씩 — 곡이 없으면 빈 카드
  const rows: Row[] = MOCK_MEMBERS.map((member) => ({
    member,
    track: tracks.find((t) => t.uid === member.uid) ?? null,
  }));
  const doneToday = tracks.some((t) => t.uid === myUid);

  const openAddTrack = () => {
    // TODO(M2): /room/{id}/track/new 모달
  };

  /** __DEV__ 전용: 헤더를 길게 눌러 로딩·빈 상태·에러를 순회한다 (데모/QA용) */
  const cycleStatus = () => {
    if (!__DEV__) return;
    const order: Status[] = ['ready', 'loading', 'empty', 'error'];
    setStatus(order[(order.indexOf(status) + 1) % order.length]);
  };

  if (status === 'error') {
    return (
      <Screen>
        <StateView
          status="error"
          title="팀을 불러오지 못했어요"
          message="네트워크 연결을 확인한 뒤 다시 시도해 주세요."
          actionLabel="다시 시도"
          onAction={() => setStatus('ready')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* 헤더 — 팀 이름 + 팀 전환 chevron / 알림 */}
      <View style={styles.header}>
        <PressableScale
          style={styles.titleRow}
          onPress={() => router.back()}
          onLongPress={cycleStatus}
          accessibilityRole="button"
          accessibilityLabel={`${teamName}, 다른 팀으로 전환`}
        >
          <Text style={typography.title} numberOfLines={1}>
            {teamName}
          </Text>
          <Icon name="chevronDown" size={size.iconLg} color={colors.text} />
        </PressableScale>

        {/* 알림 벨: 곡 등록·코멘트 반응 알림용 (스펙 §2-A). 코멘트 기능 도입 후 활성화 */}
        <View style={styles.bell}>
          <IconButton name="bell" size={size.iconLg} accessibilityLabel="알림 (준비 중)" disabled />
          <View style={styles.dot} />
        </View>
      </View>

      {/* 오늘의 미션 — 스트립 전체가 곡 등록 진입점 */}
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
            return (
              <TrackCard
                track={item.track}
                isMine={isMine}
                onMore={() => {
                  // TODO(M4): /room/{id}/track/{trackId} 모달 (수정/삭제)
                }}
              />
            );
          }
          return (
            <AddTrackCard
              nickname={item.member.nickname}
              // 남의 빈 카드는 자리만 차지한다 — 대신 올려줄 수는 없다
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
