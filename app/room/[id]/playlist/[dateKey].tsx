import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import YoutubePlayer from 'react-native-youtube-iframe';
import { aspect, colors, radius, size, spacing, typography } from '@/theme/tokens';
import { BleedScreen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Icon, IconButton } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { YoutubeArt } from '@/components/YoutubeArt';
import { buildWatchVideosUrl } from '@/lib/youtube';
import { missionFor } from '@/lib/themes';
import { toast } from '@/store/ui';
import { usePlaylistStore } from '@/store/playlist';
import { DateKeySchema } from '@/schemas';
import type { Track } from '@/types/models';

/**
 * 플레이리스트 상세 (Figma 4:1332)
 * 헤로 풀블리드 + 하단 페이드 / 참여자 겹침 아바타 / [유튜브에서 재생] + [미리듣기] / 트랙 리스트
 * dateKey별 실제 tracks/days 데이터를 보여준다. 오늘은 실시간, 과거는 1회 조회한다.
 */
const LIST_CONTENT = { paddingBottom: spacing.xxl };

/** 'YYYY-MM-DD' → 'M월 D일' */
function formatDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

export default function PlaylistDetail() {
  const { id, dateKey } = useLocalSearchParams<{ id: string; dateKey: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [queueIndex, setQueueIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const roomId = typeof id === 'string' ? id : '';
  const rawDateKey = typeof dateKey === 'string' ? dateKey : '';
  const selectedDateKey = DateKeySchema.safeParse(rawDateKey).success ? rawDateKey : '';
  const status = usePlaylistStore((s) => s.status);
  const error = usePlaylistStore((s) => s.error);
  const tracks = usePlaylistStore((s) => s.tracks);
  const day = usePlaylistStore((s) => s.day);
  const loadPlaylist = usePlaylistStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      if (!roomId || !selectedDateKey) return undefined;
      return loadPlaylist(roomId, selectedDateKey);
    }, [roomId, selectedDateKey, retryKey, loadPlaylist]),
  );

  useEffect(() => {
    setQueueIndex(0);
    setPlaying(false);
  }, [roomId, selectedDateKey]);

  // 미리듣기 큐 — embeddable === false / unavailable 곡은 인앱 재생이 안 된다
  const playable = tracks.filter((t) => t.embeddable && !t.unavailable);
  const current = playable[queueIndex];

  useEffect(() => {
    if (queueIndex < playable.length) return;
    setQueueIndex(Math.max(playable.length - 1, 0));
    if (playable.length === 0) setPlaying(false);
  }, [playable.length, queueIndex]);

  const coverVideoId = day?.coverVideoId || tracks[0]?.videoId || '';
  const participants = Array.from(new Map(tracks.map((t) => [t.uid, t])).values());
  const formattedDate = selectedDateKey ? formatDate(selectedDateKey) : '선택한 날짜';

  const goBackToRoom = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/room/${roomId}`);
  };

  /** 메인 재생: 유튜브 앱으로 핸드오프 (무인증·무쿼터 임시 재생목록) */
  const playOnYoutube = async () => {
    // 삭제된 영상은 임시 재생목록을 통째로 깨뜨릴 수 있으므로 제외한다
    const ids = tracks.filter((t) => !t.unavailable).map((t) => t.videoId);
    if (ids.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return;
    }
    try {
      await Linking.openURL(buildWatchVideosUrl(ids));
    } catch {
      // 유튜브 앱 부재·엔드포인트 차단 → 첫 곡 단독 재생으로 폴백
      toast('유튜브를 열 수 없어 첫 곡만 재생해요');
      await Linking.openURL(`https://www.youtube.com/watch?v=${ids[0]}`).catch(() => {
        toast('재생에 실패했어요. 미리듣기를 이용해 주세요.');
      });
    }
  };

  if (!roomId || !selectedDateKey) {
    return (
      <BleedScreen>
        <StateView
          status="error"
          title="플레이리스트를 열 수 없어요"
          message="팀 또는 날짜 정보가 올바르지 않아요."
          actionLabel="팀 목록으로"
          onAction={() => router.replace('/')}
        />
      </BleedScreen>
    );
  }

  if (status === 'loading') {
    return (
      <BleedScreen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            name="chevronLeft"
            accessibilityLabel="뒤로 가기"
            variant="circle"
            onPress={goBackToRoom}
          />
        </View>
        <StateView status="loading" />
      </BleedScreen>
    );
  }

  if (status === 'error') {
    return (
      <BleedScreen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            name="chevronLeft"
            accessibilityLabel="뒤로 가기"
            variant="circle"
            onPress={goBackToRoom}
          />
        </View>
        <StateView
          status="error"
          title="플레이리스트를 불러오지 못했어요"
          message={error ?? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
          actionLabel="다시 시도"
          onAction={() => setRetryKey((key) => key + 1)}
        />
      </BleedScreen>
    );
  }

  if (status === 'empty') {
    return (
      <BleedScreen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            name="chevronLeft"
            accessibilityLabel="뒤로 가기"
            variant="circle"
            onPress={goBackToRoom}
          />
        </View>
        <StateView
          status="empty"
          title="그날은 아무도 곡을 올리지 않았어요"
          message={`${formattedDate}의 플레이리스트가 비어 있어요.`}
          actionLabel="팀으로 돌아가기"
          onAction={goBackToRoom}
        />
      </BleedScreen>
    );
  }

  return (
    <BleedScreen>
      <FlatList
        data={tracks}
        keyExtractor={(t) => `${t.uid}_${t.dateKey}`}
        contentContainerStyle={LIST_CONTENT}
        ListHeaderComponent={
          <View>
            {/* 헤로 — 고정 px이 아니라 폭 기준 비율 (docs/design.md). 이미지는 videoId에서 파생 */}
            <View style={styles.hero}>
              <YoutubeArt videoId={coverVideoId} style={StyleSheet.absoluteFill} />
              <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
                <IconButton
                  name="chevronLeft"
                  accessibilityLabel="뒤로 가기"
                  variant="circle"
                  onPress={goBackToRoom}
                />
                <View style={styles.topBarRight}>
                  <IconButton
                    name="users"
                    accessibilityLabel="팀원 보기"
                    variant="circle"
                    onPress={() => {
                      // TODO(M3): /room/{id}/members 모달
                    }}
                  />
                  <IconButton
                    name="share"
                    accessibilityLabel="초대 코드 공유하기"
                    variant="circle"
                    onPress={() => {
                      // TODO(M3): 초대 코드 공유 시트
                    }}
                  />
                </View>
              </View>
              <LinearGradient colors={colors.heroFade} style={styles.heroGradient}>
                <Text style={typography.heroTitle}>{missionFor(selectedDateKey, day)}</Text>
                <Text style={typography.caption}>{formattedDate}의 플레이리스트</Text>
              </LinearGradient>
            </View>

            {/* 참여자 */}
            <View
              style={styles.membersRow}
              accessible
              accessibilityLabel={`${participants.length}명이 곡을 올렸어요`}
            >
              <View style={styles.avatars}>
                {participants.map((track) => (
                  <Avatar key={track.uid} nickname={track.nickname} size={size.avatarMd} overlap />
                ))}
              </View>
              <Text style={[typography.caption, styles.membersText]}>
                {participants.length}명이 곡을 올렸어요
              </Text>
            </View>

            {/* 메인: 유튜브 핸드오프 / 보조: 인앱 미리듣기 */}
            <View style={styles.playRow}>
              <PressableScale
                style={styles.playBtn}
                onPress={playOnYoutube}
                accessibilityRole="button"
                accessibilityLabel={`유튜브에서 전체 재생, ${tracks.length}곡`}
              >
                <Icon name="play" size={size.icon} color={colors.bg} />
                <Text style={[typography.bodyMedium, styles.playBtnText]}>유튜브에서 재생</Text>
              </PressableScale>
              <PressableScale
                style={styles.previewBtn}
                onPress={() => {
                  if (playable.length === 0) {
                    toast('미리듣기할 수 있는 곡이 없어요');
                    return;
                  }
                  setQueueIndex(0);
                  setPlaying(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="앱에서 미리듣기"
              >
                <Text style={typography.bodyMedium}>미리듣기</Text>
              </PressableScale>
            </View>

            {/* 유튜브가 TLGG 임시 재생목록에 [저장] 버튼을 제공한다 — 기능처럼 안내 */}
            <Text style={[typography.tab, styles.saveHint]}>
              유튜브에서 저장 버튼을 누르면 내 계정에 보관돼요
            </Text>

            {/* 미리듣기 플레이어 (기기별 독립) */}
            {playing && !!current && (
              <View style={styles.player}>
                <YoutubePlayer
                  height={size.player}
                  play
                  videoId={current.videoId}
                  onChangeState={(state: string) => {
                    if (state === 'ended') {
                      setQueueIndex((i) => (i + 1 < playable.length ? i + 1 : i));
                    }
                  }}
                  onError={() => {
                    // 삭제·차단된 영상 → 다음 곡으로 자동 스킵
                    setQueueIndex((i) => (i + 1 < playable.length ? i + 1 : i));
                  }}
                />
                <Text style={typography.caption}>
                  {current.nickname}님의 추천{current.comment ? ` · “${current.comment}”` : ''}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          // 렌더는 tracks 전체지만 재생 큐는 playable만 → 큐 인덱스는 videoId로 찾는다 (두 배열 어긋남 방지)
          const playableIndex = playable.findIndex((t) => t.videoId === item.videoId);
          const isPlayable = playableIndex !== -1;
          const active = isPlayable && playing && playableIndex === queueIndex;
          return (
            <PressableScale
              style={[styles.trackRow, active && styles.trackActive]}
              onPress={() => {
                // 재생 불가(유튜브 전용) 곡은 미리듣기 큐를 흔들지 않도록 탭을 막는다
                if (!isPlayable) {
                  toast('유튜브 전용 곡이라 미리듣기를 지원하지 않아요');
                  return;
                }
                setQueueIndex(playableIndex);
                setPlaying(true);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${index + 1}번째 곡, ${item.title}, ${item.artist}, ${item.nickname}님 추천${isPlayable ? '' : ', 유튜브 전용'}`}
            >
              <View>
                <YoutubeArt videoId={item.videoId} style={styles.thumb} small />
                <View style={styles.miniAvatar}>
                  <Avatar nickname={item.nickname} size={size.avatarSm} overlap />
                </View>
              </View>
              <View style={styles.trackText}>
                <Text style={typography.body} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={typography.caption} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              {!isPlayable && <Text style={[typography.tab, styles.ytOnly]}>유튜브 전용</Text>}
            </PressableScale>
          );
        }}
      />
    </BleedScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: aspect.hero, // 390:376 — 기기 폭에 비례
    justifyContent: 'space-between',
    backgroundColor: colors.card,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topBarRight: { flexDirection: 'row', gap: spacing.sm },
  heroGradient: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  avatars: { flexDirection: 'row' },
  membersText: { color: colors.text60, marginLeft: spacing.lg },
  playRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: size.ctaLg,
    paddingVertical: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: { color: colors.bg },
  previewBtn: {
    flex: 1,
    minHeight: size.ctaLg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHint: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    textAlign: 'center',
  },
  player: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: size.thumbLg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  trackActive: { backgroundColor: colors.white5 },
  thumb: {
    width: size.thumbSm,
    height: size.thumbSm,
    borderRadius: radius.input,
  },
  trackText: { flex: 1, gap: spacing.xs },
  ytOnly: { color: colors.text40 },
  miniAvatar: { position: 'absolute', right: -6, bottom: -4 },
});
