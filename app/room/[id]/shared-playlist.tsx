import { useCallback, useMemo, useState } from 'react';
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
import { YoutubeArt } from '@/components/YoutubeArt';
import { buildWatchVideosUrl } from '@/lib/youtube';
import { ensureSharedPlaylist, DEFAULT_SHARED_PLAYLIST_NAME } from '@/lib/api';
import { toMessage } from '@/lib/errors';
import { nicknameResolver } from '@/lib/displayName';
import { isMockRoomId } from '@/lib/mockPreview';
import { useSharedPlaylistStore } from '@/store/sharedPlaylist';
import { useConfigStore } from '@/store/config';
import { toast } from '@/store/ui';

/**
 * 공동 플리 (docs/배포본복원계획.md §4)
 *
 * 날짜별 목록과 다른 점: **날짜에 묶이지 않는다.** 팀이 골라 담은 곡만 모인 폴더다.
 * 재생은 날짜별 상세와 같은 규칙 — 유튜브 핸드오프가 메인, 인앱 미리듣기가 보조.
 */
const LIST_CONTENT = { paddingBottom: spacing.xxl };

export default function SharedPlaylist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [queueIndex, setQueueIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);

  const status = useSharedPlaylistStore((s) => s.status);
  const error = useSharedPlaylistStore((s) => s.error);
  const playlists = useSharedPlaylistStore((s) => s.playlists);
  const selectedId = useSharedPlaylistStore((s) => s.selectedId);
  const items = useSharedPlaylistStore((s) => s.items);
  const members = useSharedPlaylistStore((s) => s.members);
  const subscribe = useSharedPlaylistStore((s) => s.subscribe);
  const handoffMode = useConfigStore((s) => s.handoffMode);

  useFocusEffect(useCallback(() => subscribe(id), [id, subscribe]));

  // 닉네임은 members가 정본 — 아이템에 박힌 값은 담을 때의 스냅샷이다
  const who = useMemo(() => nicknameResolver(members), [members]);

  const playlist = playlists.find((p) => p.id === selectedId) ?? null;
  const coverVideoId = playlist?.coverVideoId ?? items[0]?.videoId ?? '';
  const current = items[queueIndex];
  const previewPrimary = handoffMode === 'first_video';

  /** 폴더 만들기 — 목업 방에선 쓸 수 없다(Firestore에 없는 방이라 쓰기가 막힌다) */
  const createPlaylist = async () => {
    if (creating) return;
    if (isMockRoomId(id)) {
      toast('목업 미리보기에서는 만들 수 없어요');
      return;
    }
    setCreating(true);
    try {
      await ensureSharedPlaylist({ roomId: id, name: DEFAULT_SHARED_PLAYLIST_NAME });
      toast('공동 플리를 만들었어요');
    } catch (e: unknown) {
      toast(toMessage(e));
    } finally {
      setCreating(false);
    }
  };

  /** 메인 재생: 유튜브 앱 핸드오프 (날짜별 상세와 같은 폴백 규칙) */
  const playOnYoutube = async () => {
    const ids = items.map((i) => i.videoId);
    if (ids.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return;
    }
    const url = previewPrimary
      ? `https://www.youtube.com/watch?v=${ids[0]}`
      : buildWatchVideosUrl(ids);
    try {
      await Linking.openURL(url);
    } catch {
      toast('유튜브를 열 수 없어 첫 곡만 재생해요');
      await Linking.openURL(`https://www.youtube.com/watch?v=${ids[0]}`).catch(() => {
        toast('재생에 실패했어요. 미리듣기를 이용해 주세요.');
      });
    }
  };

  const startPreview = () => {
    if (items.length === 0) {
      toast('미리듣기할 수 있는 곡이 없어요');
      return;
    }
    setQueueIndex(0);
    setPlaying(true);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.titleRow}>
        <IconButton
          name="chevronLeft"
          size={size.iconLg}
          accessibilityLabel="뒤로 가기"
          onPress={() => router.back()}
        />
        <Text style={typography.title} numberOfLines={1}>
          공동 플리
        </Text>
      </View>
      <IconButton
        name="plus"
        size={size.iconLg}
        accessibilityLabel="즐겨찾는 노래 폴더 만들기"
        onPress={createPlaylist}
        disabled={creating}
      />
    </View>
  );

  if (status === 'loading') {
    return (
      <BleedScreen>
        {header}
        <StateView status="loading" />
      </BleedScreen>
    );
  }

  if (status === 'error') {
    return (
      <BleedScreen>
        {header}
        <StateView
          status="error"
          title="공동 플리를 불러오지 못했어요"
          message={error ?? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
          actionLabel="다시 시도"
          onAction={() => subscribe(id)}
        />
      </BleedScreen>
    );
  }

  if (items.length === 0) {
    return (
      <BleedScreen>
        {header}
        <StateView
          status="empty"
          title="공동 플리가 아직 없어요"
          message="즐겨 듣는 곡을 날짜별 플레이리스트에서 공동 플리에 곡을 담아 보세요."
          actionLabel="팀으로 돌아가기"
          onAction={() => router.back()}
        />
      </BleedScreen>
    );
  }

  return (
    <BleedScreen>
      {header}
      <FlatList
        data={items}
        keyExtractor={(i) => i.videoId}
        contentContainerStyle={LIST_CONTENT}
        ListHeaderComponent={
          <View>
            {/* 커버 — 폴더의 첫 곡에서 파생 (videoId가 원본, URL은 저장하지 않는다) */}
            <View style={styles.hero}>
              <YoutubeArt videoId={coverVideoId} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={colors.heroFade} style={styles.heroGradient}>
                <Text style={typography.heroTitle}>
                  {playlist?.name ?? DEFAULT_SHARED_PLAYLIST_NAME}
                </Text>
                <Text style={typography.caption}>{items.length}곡</Text>
              </LinearGradient>
            </View>

            <View style={styles.playRow}>
              <PressableScale
                style={[styles.cta, previewPrimary ? styles.ctaSecondary : styles.ctaPrimary]}
                onPress={playOnYoutube}
                accessibilityRole="button"
                accessibilityLabel={
                  previewPrimary ? '유튜브에서 첫 곡 재생' : `공동 플리 유튜브에서 재생, ${items.length}곡`
                }
              >
                <Icon name="play" size={size.icon} color={previewPrimary ? colors.text : colors.bg} />
                <Text style={[typography.bodyMedium, !previewPrimary && styles.onPrimary]}>
                  {previewPrimary ? '유튜브에서 첫 곡' : '유튜브에서 재생'}
                </Text>
              </PressableScale>
              <PressableScale
                style={[styles.cta, previewPrimary ? styles.ctaPrimary : styles.ctaSecondary]}
                onPress={startPreview}
                accessibilityRole="button"
                accessibilityLabel="앱에서 미리듣기"
              >
                <Text style={[typography.bodyMedium, previewPrimary && styles.onPrimary]}>
                  미리듣기
                </Text>
              </PressableScale>
            </View>

            <Text style={[typography.tab, styles.saveHint]}>
              유튜브에서 저장 버튼을 누르면 내 계정에 보관돼요
            </Text>

            {playing && !!current && (
              <View style={styles.player}>
                <YoutubePlayer
                  height={size.player}
                  play
                  videoId={current.videoId}
                  onChangeState={(state: string) => {
                    if (state === 'ended') {
                      setQueueIndex((i) => (i + 1 < items.length ? i + 1 : i));
                    }
                  }}
                  onError={() => {
                    // 삭제·차단된 영상 → 다음 곡으로 자동 스킵
                    setQueueIndex((i) => (i + 1 < items.length ? i + 1 : i));
                  }}
                />
                <Text style={typography.caption}>
                  {who(current.recommendedByUid, current.recommendedByNickname)}님 추천
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <PressableScale
            style={styles.row}
            onPress={() => {
              setQueueIndex(index);
              setPlaying(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.artist}, ${who(item.recommendedByUid, item.recommendedByNickname)}님 추천`}
          >
            <YoutubeArt videoId={item.videoId} style={styles.thumb} />
            <View style={styles.rowText}>
              <Text style={typography.bodyMedium} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {item.artist} · {who(item.recommendedByUid, item.recommendedByNickname)}님 추천
              </Text>
            </View>
          </PressableScale>
        )}
      />
    </BleedScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  hero: {
    width: '100%',
    aspectRatio: aspect.hero,
    justifyContent: 'flex-end',
  },
  heroGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  playRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
  },
  ctaPrimary: {
    backgroundColor: colors.text,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: colors.white10,
  },
  onPrimary: {
    color: colors.bg,
  },
  saveHint: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    color: colors.textMuted,
  },
  player: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  thumb: {
    width: size.thumbSm,
    aspectRatio: aspect.thumbnail,
    borderRadius: radius.sm,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
});
