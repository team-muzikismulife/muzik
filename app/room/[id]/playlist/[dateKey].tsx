import { useCallback, useState } from 'react';
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
import { themeFor } from '@/lib/themes';
import { useRoomStore } from '@/store/room';
import { useConfigStore } from '@/store/config';
import { toast } from '@/store/ui';

/**
 * 플레이리스트 상세 (Figma 4:1332) — 실데이터 구독 (M3)
 * 헤로 풀블리드 + 하단 페이드 / 참여자 겹침 아바타 / [유튜브에서 재생] + [미리듣기] / 트랙 리스트
 *
 * dateKey는 라우트 고정값 → 그 날짜의 tracks/members/room을 room store로 구독한다.
 * 히어로·재생 순서는 order asc의 첫 곡이 곧 그날 대표(cover)라 tracks[0]에서 파생한다.
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

  const room = useRoomStore((s) => s.room);
  const members = useRoomStore((s) => s.members);
  const tracks = useRoomStore((s) => s.tracks);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const subscribe = useRoomStore((s) => s.subscribe);
  const handoffMode = useConfigStore((s) => s.handoffMode);

  // 포커스 중에만 구독 — 이 날짜의 tracks/members/room (이탈 시 unsubscribe)
  useFocusEffect(useCallback(() => subscribe(id, dateKey), [id, dateKey, subscribe]));

  // 미리듣기 큐 — embeddable === false / unavailable 곡은 인앱 재생이 안 된다
  const playable = tracks.filter((t) => t.embeddable && !t.unavailable);
  const current = playable[queueIndex];
  // 히어로 = 그날의 대표 곡 = order 최소(첫 등록) 곡. days.coverVideoId와 같은 값이다.
  const coverVideoId = tracks[0]?.videoId ?? '';
  // 킬스위치: first_video면 첫 곡 watch URL만 열고 미리듣기를 메인으로 승격 (유튜브연동설계 §3-3)
  const previewPrimary = handoffMode === 'first_video';

  /** 메인 재생: 유튜브 앱으로 핸드오프 (무인증·무쿼터 임시 재생목록) */
  const playOnYoutube = async () => {
    // 삭제된 영상은 임시 재생목록을 통째로 깨뜨릴 수 있으므로 제외한다
    const ids = tracks.filter((t) => !t.unavailable).map((t) => t.videoId);
    if (ids.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return;
    }
    // first_video 킬스위치: watch_videos가 막혔을 때 첫 곡만 연다
    const url = previewPrimary
      ? `https://www.youtube.com/watch?v=${ids[0]}`
      : buildWatchVideosUrl(ids);
    try {
      await Linking.openURL(url);
    } catch {
      // 유튜브 앱 부재·엔드포인트 차단 → 첫 곡 단독 재생으로 폴백
      toast('유튜브를 열 수 없어 첫 곡만 재생해요');
      await Linking.openURL(`https://www.youtube.com/watch?v=${ids[0]}`).catch(() => {
        toast('재생에 실패했어요. 미리듣기를 이용해 주세요.');
      });
    }
  };

  const startPreview = () => {
    if (playable.length === 0) {
      toast('미리듣기할 수 있는 곡이 없어요');
      return;
    }
    setQueueIndex(0);
    setPlaying(true);
  };


  const backBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton
        name="chevronLeft"
        accessibilityLabel="뒤로 가기"
        variant="circle"
        onPress={() => router.back()}
      />
    </View>
  );

  if (status === 'loading') {
    return (
      <BleedScreen>
        {backBar}
        <StateView status="loading" />
      </BleedScreen>
    );
  }

  if (status === 'error') {
    return (
      <BleedScreen>
        {backBar}
        <StateView
          status="error"
          title="플레이리스트를 불러오지 못했어요"
          message={error ?? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
          actionLabel="다시 시도"
          onAction={() => subscribe(id, dateKey)}
        />
      </BleedScreen>
    );
  }

  if (tracks.length === 0) {
    return (
      <BleedScreen>
        {backBar}
        <StateView
          status="empty"
          title="그날은 아무도 곡을 올리지 않았어요"
          message={`${formatDate(dateKey)}의 플레이리스트가 비어 있어요.`}
          actionLabel="팀으로 돌아가기"
          onAction={() => router.back()}
        />
      </BleedScreen>
    );
  }

  return (
    <BleedScreen>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.videoId}
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
                  onPress={() => router.back()}
                />
                {/* 초대·공유는 팀원·초대 모달로 단일화 — 여기선 진입만 */}
                <IconButton
                  name="users"
                  accessibilityLabel="팀원·초대 코드"
                  variant="circle"
                  onPress={() => router.push(`/room/${id}/members`)}
                />
              </View>
              <LinearGradient colors={colors.heroFade} style={styles.heroGradient}>
                {/* TODO(M4): 과거(dateKey !== todayKey())는 days.themeText 스냅샷을 써야 한다.
                    themeFor는 오늘 테마 계산용 — THEMES 풀이 바뀌면 과거 테마가 소급 변조된다 (구현계획서 §2) */}
                <Text style={typography.heroTitle}>{themeFor(dateKey)}</Text>
                <Text style={typography.caption}>{formatDate(dateKey)}의 플레이리스트</Text>
              </LinearGradient>
            </View>

            {/* 참여자 — 실멤버 (아바타는 최대 4명 노출, 인원수는 전체) */}
            <View
              style={styles.membersRow}
              accessible
              accessibilityLabel={`${members.length}명이 함께 듣고 있어요`}
            >
              <View style={styles.avatars}>
                {members.slice(0, 4).map((m) => (
                  <Avatar key={m.uid} nickname={m.nickname} color={m.photoColor} size={size.avatarMd} overlap />
                ))}
              </View>
              <Text style={[typography.caption, styles.membersText]}>
                {members.length}명이 함께 듣고 있어요
              </Text>
            </View>

            {/* 메인: 유튜브 핸드오프 / 보조: 인앱 미리듣기.
                킬스위치(first_video)면 둘의 주·보조가 뒤바뀐다 — 미리듣기가 메인으로 승격. */}
            <View style={styles.playRow}>
              <PressableScale
                style={[styles.cta, previewPrimary ? styles.ctaSecondary : styles.ctaPrimary]}
                onPress={playOnYoutube}
                accessibilityRole="button"
                accessibilityLabel={
                  previewPrimary ? '유튜브에서 첫 곡 재생' : `유튜브에서 전체 재생, ${tracks.length}곡`
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
                <Text style={[typography.bodyMedium, previewPrimary && styles.onPrimary]}>미리듣기</Text>
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
  cta: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: size.ctaLg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: { backgroundColor: colors.text },
  ctaSecondary: { backgroundColor: colors.white10 },
  onPrimary: { color: colors.bg },
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
