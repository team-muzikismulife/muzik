import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { colors, opacity, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { IconButton } from '@/components/Icon';
import { YoutubeArt } from '@/components/YoutubeArt';
import { registerTrack } from '@/lib/api';
import { extractVideoId, fetchVideoMeta, type VideoMeta } from '@/lib/youtube';
import { isAlreadyRegistered, isOffline, toMessage } from '@/lib/errors';
import { CommentSchema } from '@/schemas';
import { useTrackStore } from '@/store/tracks';
import { toast } from '@/store/ui';
import { todayKey } from '@/lib/date';

const COMMENT_MAX = 30;
/** oEmbed는 붙여넣기가 끝난 뒤 한 번만 — 매 타건마다 때리지 않는다 */
const FETCH_DEBOUNCE_MS = 400;

/**
 * 미리보기 상태 머신 (docs/곡등록설계.md §4)
 *   idle ──URL입력──▶ fetching ──oEmbed성공──▶ preview
 *     ▲                  │                        │
 *     └── inputError ◀───┴── 파싱실패 / oEmbed404 ─┘
 * preview 전에는 등록 버튼이 잠긴다 — 곡을 확인하지 않고 올릴 수 없다.
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'fetching' }
  | { kind: 'preview'; meta: VideoMeta }
  | { kind: 'inputError'; message: string };

interface Props {
  roomId: string;
  /** TODO(M1): session.uid / members[uid].nickname 로 교체 — 지금은 홈 데모 정체성과 맞춘다 */
  uid: string;
  nickname: string;
}

/**
 * 곡 등록 폼 — 등록·수정 공용을 의도하지만 M2-a는 `create`만 구현한다(수정은 M4).
 * 등록 성공 → 모달을 닫으면 홈이 track store 구독으로 즉시 반영한다(§3 step 11).
 */
export function TrackForm({ roomId, uid, nickname }: Props) {
  const router = useRouter();

  // 재진입 분기(§6·§9): 오늘 이미 올렸으면 폼 대신 "이미 올렸어요"를 보여준다.
  const alreadyToday = useTrackStore((s) => s.has(uid, todayKey()));
  const [alreadyDone, setAlreadyDone] = useState(alreadyToday);

  const [url, setUrl] = useState('');
  const [comment, setComment] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);

  // 최신 요청만 반영 — 느린 oEmbed가 뒤늦게 와서 새 입력을 덮어쓰지 않도록(§7)
  const reqId = useRef(0);

  // 클립보드 자동 감지(§3 step 1) — 유튜브 링크가 있으면 채워 준다
  useEffect(() => {
    let alive = true;
    Clipboard.getStringAsync()
      .then((c) => {
        if (alive && c && extractVideoId(c)) setUrl(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // URL → 파싱 → oEmbed 미리보기 (디바운스)
  useEffect(() => {
    const raw = url.trim();
    if (!raw) {
      setPhase({ kind: 'idle' });
      return;
    }
    const videoId = extractVideoId(raw);
    if (!videoId) {
      setPhase({ kind: 'inputError', message: '유튜브 링크가 아닌 것 같아요' });
      return;
    }

    const id = ++reqId.current;
    setPhase({ kind: 'fetching' });
    const timer = setTimeout(() => {
      fetchVideoMeta(videoId)
        .then((meta) => {
          if (id === reqId.current) setPhase({ kind: 'preview', meta });
        })
        .catch((e: unknown) => {
          if (id !== reqId.current) return;
          // RN fetch는 네트워크 실패를 TypeError로 던진다(§7 오프라인) — 404(없는 영상)와 구분한다
          const offline = e instanceof TypeError || isOffline(e);
          setPhase({
            kind: 'inputError',
            message: offline
              ? '네트워크 연결 후 다시 시도해 주세요'
              : '없는 영상이거나 비공개예요',
          });
        });
    }, FETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [url]);

  const canSubmit = phase.kind === 'preview' && !submitting;

  const submit = async () => {
    if (phase.kind !== 'preview' || submitting) return;
    setSubmitting(true);
    try {
      await registerTrack(
        { roomId, videoId: phase.meta.videoId, comment },
        { meta: phase.meta, uid, nickname },
      );
      toast('오늘의 곡을 올렸어요');
      router.back();
    } catch (e: unknown) {
      // already-exists는 막다른 에러가 아니다 — 재진입 분기로 보낸다(§6)
      if (isAlreadyRegistered(e)) setAlreadyDone(true);
      // 오프라인·기타: 토스트만, 입력값은 유지한다(다시 치게 하지 않는다, §7)
      else toast(toMessage(e, 'registerTrack'));
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyDone) {
    return (
      <Screen>
        <FormHeader title="오늘의 곡" onClose={() => router.back()} />
        <View style={styles.body}>
          <Text style={typography.title}>오늘은 이미 곡을 올렸어요</Text>
          <Text style={[typography.caption, styles.help]}>
            하루에 한 곡이에요. 수정은 곧 열려요.
          </Text>
          {/* TODO(M4): [내 곡 수정하기] → /room/{id}/track/{trackId} 모달 */}
          <PressableScale
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="돌아가기"
          >
            <Text style={typography.bodyMedium}>돌아가기</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FormHeader title="오늘의 곡 등록" onClose={() => router.back()} />

        <View style={styles.body}>
          <View>
            <Text style={[typography.caption, styles.label]}>유튜브 링크</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="유튜브 링크를 붙여넣으세요"
              placeholderTextColor={colors.text40}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              accessibilityLabel="유튜브 링크 입력"
            />
            {phase.kind === 'inputError' && (
              <Text style={[typography.caption, styles.inlineError]}>{phase.message}</Text>
            )}
          </View>

          {/* 미리보기 — preview 전에는 등록 버튼이 잠긴다(§4) */}
          {phase.kind === 'fetching' && <PreviewSkeleton />}
          {phase.kind === 'preview' && <Preview meta={phase.meta} />}

          <View>
            <View style={styles.labelRow}>
              <Text style={[typography.caption, styles.label]}>한 줄 코멘트 (선택)</Text>
              <Text style={[typography.caption, styles.counter]}>
                {comment.length}/{COMMENT_MAX}
              </Text>
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="이 곡을 고른 이유"
              placeholderTextColor={colors.text40}
              style={styles.input}
              maxLength={COMMENT_MAX}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="한 줄 코멘트 입력"
            />
          </View>

          <PressableScale
            style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="오늘의 곡 등록하기"
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={typography.bodyMedium}>등록하기</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FormHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton name="chevronLeft" size={size.iconLg} accessibilityLabel="닫기" onPress={onClose} />
      <Text style={typography.title}>{title}</Text>
    </View>
  );
}

/** 미리보기 카드 — 16:9 썸네일 + 제목·채널명. 배경은 videoId 파생이라 곡과 어긋날 수 없다 */
function Preview({ meta }: { meta: VideoMeta }) {
  return (
    <View style={styles.preview} accessible accessibilityLabel={`미리보기: ${meta.title}, ${meta.author}`}>
      <YoutubeArt videoId={meta.videoId} style={styles.previewArt} />
      <View style={styles.previewText}>
        <Text style={typography.bodyMedium} numberOfLines={2}>
          {meta.title}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {meta.author}
        </Text>
      </View>
    </View>
  );
}

function PreviewSkeleton() {
  return (
    <View style={styles.preview}>
      <View style={[styles.previewArt, styles.skeleton]} />
      <View style={styles.previewText}>
        <View style={[styles.skeletonLine, { width: '80%' }]} />
        <View style={[styles.skeletonLine, { width: '40%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // IconButton이 44pt 터치 박스를 가져 좌측 패딩을 줄여 시각 정렬을 맞춘다
    paddingLeft: spacing.md,
    paddingRight: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  body: { gap: spacing.xl, padding: spacing.xxl },
  label: { marginBottom: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: colors.text40 },
  help: { color: colors.text60 },
  input: {
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: size.touch,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  inlineError: { color: colors.danger, marginTop: spacing.xs },
  preview: { gap: spacing.md },
  previewArt: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.card },
  previewText: { gap: 2 },
  skeleton: { backgroundColor: colors.skeleton },
  skeletonLine: {
    height: size.skeletonLine,
    borderRadius: radius.thumb,
    backgroundColor: colors.skeleton,
  },
  btn: {
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  btnPrimary: {
    backgroundColor: colors.white10,
    borderWidth: 1,
    borderColor: colors.white60,
  },
  btnDisabled: { opacity: opacity.disabled },
});
