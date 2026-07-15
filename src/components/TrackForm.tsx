import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { colors, opacity, radius, size, spacing, typography } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Icon } from './Icon';
import { VideoPreview, type VideoMetaPreview } from './VideoPreview';
import { extractVideoId, fetchVideoMeta } from '@/lib/youtube';
import { registerTrack } from '@/lib/api';
import { fieldError, CommentSchema } from '@/schemas';
import { isAlreadyRegistered, toMessage } from '@/lib/errors';
import { toast } from '@/store/ui';

interface Props {
  roomId: string;
  /** 이 팀에서 내 닉네임 (트랙에 비정규화 저장) */
  nickname: string;
}

const COMMENT_MAX = 30;

/**
 * 곡 등록 폼 (docs/곡등록설계.md §4 상태 머신)
 * idle → parsing → fetching → preview → submitting
 * 붙여넣기 즉시 로컬 파싱 + oEmbed 미리보기(체감 지연 0), 진짜 검증은 등록 시.
 */
export function TrackForm({ roomId, nickname }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [meta, setMeta] = useState<VideoMetaPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string>();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // oEmbed 경합 방지 — 마지막 요청만 반영 (입력이 빠르면 이전 응답이 늦게 와 뒤덮는다)
  const reqId = useRef(0);

  const onChangeUrl = async (text: string) => {
    setUrl(text);
    const videoId = extractVideoId(text.trim());
    if (!videoId) {
      setMeta(null);
      setPreviewStatus(text.trim() ? 'error' : 'idle');
      setPreviewError('유튜브 링크가 아닌 것 같아요');
      return;
    }
    const my = ++reqId.current;
    setPreviewStatus('loading');
    try {
      const m = await fetchVideoMeta(videoId);
      if (my !== reqId.current) return; // 더 최신 입력이 있으면 버린다
      setMeta({ videoId: m.videoId, title: m.title, artist: m.author });
      setPreviewStatus('ready');
    } catch {
      if (my !== reqId.current) return;
      setMeta(null);
      setPreviewStatus('error');
      setPreviewError('없는 영상이거나 비공개예요');
    }
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) onChangeUrl(text);
  };

  const commentError = fieldError(CommentSchema, comment);
  const canSubmit = previewStatus === 'ready' && !!meta && !commentError && !submitting;

  const submit = async () => {
    if (!canSubmit || !meta) return;
    setSubmitting(true);
    try {
      await registerTrack({
        roomId,
        videoId: meta.videoId,
        comment: comment.trim(),
        nickname,
        title: meta.title,
        artist: meta.artist,
      });
      router.back(); // 홈 구독이 즉시 반영한다
    } catch (e: unknown) {
      if (isAlreadyRegistered(e)) {
        // 에러가 아니라 분기 — 오늘 이미 올렸다 (M4 수정 화면 도입 전까진 안내만)
        toast('오늘은 이미 곡을 올렸어요');
        router.back();
        return;
      }
      toast(toMessage(e, 'registerTrack'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.body}>
      {/* URL 입력 + 붙여넣기 */}
      <View>
        <Text style={[typography.caption, styles.label]}>유튜브 링크</Text>
        <View style={styles.urlRow}>
          <TextInput
            value={url}
            onChangeText={onChangeUrl}
            placeholder="https://youtu.be/..."
            placeholderTextColor={colors.text40}
            style={[styles.input, styles.flex]}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="유튜브 링크 입력"
          />
          <PressableScale
            style={styles.pasteBtn}
            onPress={paste}
            accessibilityRole="button"
            accessibilityLabel="붙여넣기"
          >
            <Icon name="clipboard" size={size.icon} color={colors.text} />
          </PressableScale>
        </View>
      </View>

      <VideoPreview status={previewStatus} meta={meta} errorText={previewError} />

      {/* 코멘트 */}
      <View>
        <View style={styles.labelRow}>
          <Text style={typography.caption}>한 줄 코멘트</Text>
          <Text style={[typography.tab, comment.length > COMMENT_MAX && styles.over]}>
            {comment.length}/{COMMENT_MAX}
          </Text>
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="이 곡을 고른 이유 (선택)"
          placeholderTextColor={colors.text40}
          style={styles.input}
          maxLength={COMMENT_MAX + 10} // 살짝 넘겨 입력은 되게 하고, 카운터로 경고
          accessibilityLabel="코멘트 입력"
        />
        {!!commentError && <Text style={styles.error}>{commentError}</Text>}
      </View>

      <PressableScale
        style={[styles.submit, !canSubmit && styles.disabled]}
        disabled={!canSubmit}
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="곡 등록하기"
      >
        {submitting ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={[typography.bodyMedium, styles.submitText]}>등록하기</Text>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, padding: spacing.xxl },
  flex: { flex: 1 },
  label: { marginBottom: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  over: { color: colors.danger },
  urlRow: { flexDirection: 'row', gap: spacing.sm },
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
  pasteBtn: {
    width: size.touch,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white10,
    borderRadius: radius.sm,
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  submit: {
    minHeight: size.ctaLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.full,
  },
  submitText: { color: colors.bg },
  disabled: { opacity: opacity.disabled },
});
