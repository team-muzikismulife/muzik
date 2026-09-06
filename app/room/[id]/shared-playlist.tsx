import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aspect, colors, radius, size, spacing, typography } from '@/theme/tokens';
import { BleedScreen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { Avatar } from '@/components/Avatar';
import { Icon, IconButton } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { YoutubeArt } from '@/components/YoutubeArt';
import { YoutubePreview } from '@/components/YoutubePreview';
import { buildWatchVideosUrl } from '@/lib/youtube';
import { toast } from '@/store/ui';
import { useRoomStore } from '@/store/room';
import { useSharedPlaylistStore } from '@/store/sharedPlaylist';
import type { Track } from '@/types/models';

/**
 * 공동 공유 플레이리스트 (Figma 409:2610)
 * 방 전체 tracks를 유튜브 재생목록처럼 모아 보여준다.
 */

const LIST_CONTENT = { paddingBottom: spacing.xxl };
const MAX_PARTICIPANTS = 4;

interface TrackWithPhoto extends Track {
  photoURL?: string;
  photoUrl?: string;
  userPhotoURL?: string;
}

function trackKey(track: Track): string {
  return `${track.uid}_${track.dateKey}`;
}

function profileUrl(track: Track): string | undefined {
  const withPhoto = track as TrackWithPhoto;
  return withPhoto.photoURL ?? withPhoto.photoUrl ?? withPhoto.userPhotoURL;
}

function formatUpdated(dateKey: string): string {
  return dateKey.replaceAll('-', '.');
}

function uniqueParticipants(tracks: Track[]): Track[] {
  return Array.from(new Map(tracks.map((track) => [track.uid, track])).values());
}

function ProfileBadge({ track, badgeSize }: { track: Track; badgeSize: number }) {
  const url = profileUrl(track);

  return (
    <View style={[styles.profileBadge, { width: badgeSize, height: badgeSize }]}>
      {url ? (
        <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Avatar
          nickname={track.nickname}
          size={badgeSize - spacing.xs}
          color={undefined}
        />
      )}
    </View>
  );
}

function SharedTrackRow({
  track,
  active,
  onPress,
}: {
  track: Track;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.trackRow, active && styles.trackActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${track.title}, ${track.artist}, ${track.nickname}님 추천`}
    >
      <View style={styles.thumbWrap}>
        <YoutubeArt videoId={track.videoId} style={styles.thumb} small />
        <View style={styles.rowBadge}>
          <ProfileBadge track={track} badgeSize={size.avatarSm} />
        </View>
      </View>
      <View style={styles.trackText}>
        <Text style={typography.body} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[typography.caption, styles.artist]} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      {track.unavailable && <Text style={[typography.tab, styles.ytOnly]}>재생 불가</Text>}
    </PressableScale>
  );
}

export default function SharedPlaylist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [queueIndex, setQueueIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const roomId = typeof id === 'string' ? id : '';
  const room = useRoomStore((s) => s.room);
  const status = useSharedPlaylistStore((s) => s.status);
  const error = useSharedPlaylistStore((s) => s.error);
  const tracks = useSharedPlaylistStore((s) => s.tracks);
  const subscribeSharedPlaylist = useSharedPlaylistStore((s) => s.subscribe);

  useFocusEffect(
    useCallback(() => {
      if (!roomId) return undefined;
      return subscribeSharedPlaylist(roomId);
    }, [roomId, retryKey, subscribeSharedPlaylist]),
  );

  useEffect(() => {
    setQueueIndex(0);
    setPlaying(false);
  }, [roomId]);

  const playable = tracks.filter((track) => track.embeddable && !track.unavailable);
  const current = playable[queueIndex];
  const activeKey = current ? trackKey(current) : '';
  const participants = uniqueParticipants(tracks);
  const visibleParticipants = participants.slice(0, MAX_PARTICIPANTS);
  const coverVideoId = tracks.find((track) => !track.unavailable)?.videoId ?? tracks[0]?.videoId ?? '';
  const latestDateKey = tracks[tracks.length - 1]?.dateKey;
  const title = room?.name ?? '공동 플리';

  useEffect(() => {
    if (queueIndex < playable.length) return;
    setQueueIndex(Math.max(playable.length - 1, 0));
    if (playable.length === 0) setPlaying(false);
  }, [playable.length, queueIndex]);

  const goBackToRoom = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/room/${roomId}`);
  };

  const playOnYoutube = async () => {
    const ids = tracks.filter((track) => !track.unavailable).map((track) => track.videoId);
    if (ids.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return;
    }
    try {
      await Linking.openURL(buildWatchVideosUrl(ids));
    } catch {
      toast('유튜브를 열 수 없어 첫 곡만 재생해요');
      await Linking.openURL(`https://www.youtube.com/watch?v=${ids[0]}`).catch(() => {
        toast('재생에 실패했어요. 잠시 후 다시 시도해 주세요.');
      });
    }
  };

  const playPreview = () => {
    if (playable.length === 0) {
      toast('미리듣기할 수 있는 곡이 없어요');
      return;
    }
    setQueueIndex(0);
    setPlaying(true);
  };

  if (!roomId) {
    return (
      <BleedScreen>
        <StateView
          status="error"
          title="공동 플리를 열 수 없어요"
          message="팀 정보가 올바르지 않아요."
          actionLabel="팀 목록으로"
          onAction={() => router.replace('/')}
        />
      </BleedScreen>
    );
  }

  if (status === 'loading') {
    return (
      <BleedScreen>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
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
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <IconButton
            name="chevronLeft"
            accessibilityLabel="뒤로 가기"
            variant="circle"
            onPress={goBackToRoom}
          />
        </View>
        <StateView
          status="error"
          title="공동 플리를 불러오지 못했어요"
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
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <IconButton
            name="chevronLeft"
            accessibilityLabel="뒤로 가기"
            variant="circle"
            onPress={goBackToRoom}
          />
        </View>
        <StateView
          status="empty"
          title="아직 공동 플리가 비어 있어요"
          message="팀원이 곡을 올리면 여기에 모여요."
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
        keyExtractor={trackKey}
        contentContainerStyle={LIST_CONTENT}
        ListEmptyComponent={
          <StateView
            status="empty"
            title="아직 공동 플리가 비어 있어요"
            message="팀원이 곡을 올리면 여기에 모여요."
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <View style={styles.heroImage}>
                {!!coverVideoId && <YoutubeArt videoId={coverVideoId} style={StyleSheet.absoluteFill} />}
              </View>
              <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
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
                    onPress={() => toast('팀원 보기는 다음 단계에서 연결할게요')}
                  />
                  <IconButton
                    name="download"
                    accessibilityLabel="재생목록 저장하기"
                    variant="circle"
                    onPress={() => toast('유튜브에서 저장 버튼을 눌러 보관할 수 있어요')}
                  />
                  <IconButton
                    name="moreVertical"
                    accessibilityLabel="더보기"
                    variant="circle"
                    onPress={() => toast('공동 플리 설정은 다음 단계에서 연결할게요')}
                  />
                </View>
              </View>
              <LinearGradient colors={colors.heroFade} style={styles.heroGradient}>
                <Text style={typography.heroTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={typography.caption} numberOfLines={1}>
                  최근 업데이트 {latestDateKey ? formatUpdated(latestDateKey) : '-'}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.membersRow}>
              <View style={styles.avatars}>
                {visibleParticipants.map((track) => (
                  <View key={track.uid} style={styles.participantBubble}>
                    <ProfileBadge track={track} badgeSize={size.avatarMd} />
                  </View>
                ))}
              </View>
              <Text style={[typography.caption, styles.membersText]} numberOfLines={1}>
                {participants.length}명이 함께 듣고 있어요
              </Text>
            </View>

            <View style={styles.playRow}>
              <PressableScale
                style={styles.playBtn}
                onPress={playOnYoutube}
                accessibilityRole="button"
                accessibilityLabel={`유튜브에서 공동 플리 재생, ${tracks.length}곡`}
              >
                <Icon name="play" size={size.icon} color={colors.bg} />
                <Text style={[typography.bodyMedium, styles.playBtnText]}>재생</Text>
              </PressableScale>
              <PressableScale
                style={styles.previewBtn}
                onPress={playPreview}
                accessibilityRole="button"
                accessibilityLabel="전 멤버 곡 미리듣기"
              >
                <Text style={typography.bodyMedium}>전 멤버 재생</Text>
              </PressableScale>
            </View>

            {playing && !!current && (
              <View style={styles.player}>
                <YoutubePreview
                  height={size.player}
                  play
                  videoId={current.videoId}
                  onChangeState={(state: string) => {
                    if (state === 'ended') {
                      setQueueIndex((i) => (i + 1 < playable.length ? i + 1 : i));
                    }
                  }}
                  onError={() => {
                    setQueueIndex((i) => (i + 1 < playable.length ? i + 1 : i));
                  }}
                />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const playableIndex = playable.findIndex((track) => trackKey(track) === trackKey(item));
          const isPlayable = playableIndex !== -1;
          return (
            <SharedTrackRow
              track={item}
              active={activeKey === trackKey(item)}
              onPress={() => {
                if (!isPlayable) {
                  toast(item.unavailable ? '재생할 수 없는 곡이에요' : '유튜브 전용 곡이에요');
                  return;
                }
                setQueueIndex(playableIndex);
                setPlaying(true);
              }}
            />
          );
        }}
      />
    </BleedScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: aspect.hero,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    left: -spacing.xxxl,
    right: -spacing.xxxl,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topBarRight: { flexDirection: 'row', gap: spacing.sm },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: size.avatarMd + spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  avatars: { flexDirection: 'row' },
  participantBubble: { marginRight: -spacing.xs },
  membersText: { flex: 1, color: colors.text60 },
  playRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
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
  player: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: size.thumbSm + spacing.xxl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  trackActive: { backgroundColor: colors.white5 },
  thumbWrap: {
    width: size.thumbSm,
    height: size.thumbSm,
  },
  thumb: {
    width: size.thumbSm,
    height: size.thumbSm,
    borderRadius: radius.input,
  },
  rowBadge: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
  },
  profileBadge: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackText: { flex: 1, gap: spacing.xs },
  artist: { color: colors.text40 },
  ytOnly: { color: colors.text40 },
});
