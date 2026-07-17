import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { VideoPreview } from './VideoPreview';
import { extractVideoId, fetchVideoMeta, parseTitle } from '@/lib/youtube';
import { searchTrack } from '@/lib/itunes';
import { registerTrack, updateTrack, deleteTrack } from '@/lib/api';
import { fieldError, ArtistSchema, CommentSchema, TitleSchema } from '@/schemas';
import { isAlreadyRegistered, toMessage } from '@/lib/errors';
import { toast } from '@/store/ui';
import type { Track } from '@/types/models';

interface Props {
  roomId: string;
  /** 이 팀에서 내 닉네임 (트랙에 비정규화 저장) */
  nickname: string;
  /** 공유(Share Target·딥링크)로 넘어온 링크 — 있으면 폼을 프리필한다 (M5 준비) */
  initialUrl?: string;
  /** 오늘 내가 이미 올린 곡 — 있으면 **수정 모드**(값 프리필 + 수정/삭제) */
  editTrack?: Track;
}

const COMMENT_MAX = 30;
const FIELD_MAX = 80;

/**
 * 곡 등록 폼 (docs/곡등록설계.md §4 상태 머신)
 * idle → parsing → fetching → preview → submitting
 *
 * 붙여넣기 즉시 로컬 파싱 + oEmbed 미리보기(체감 지연 0). 곡명/가수는 parseTitle로 정리한 뒤
 * iTunes로 한 번 더 보정하고, **편집 가능한 입력**으로 노출한다(틀리면 사용자가 고침). 진짜 검증은 등록 시.
 */
export function TrackForm({ roomId, nickname, initialUrl, editTrack }: Props) {
  const router = useRouter();
  // 수정 모드: 저장된 값을 그대로 시드하고 미리보기를 바로 ready로 (자동 파싱·클립보드 감지 안 함)
  const [url, setUrl] = useState(editTrack ? `https://youtu.be/${editTrack.videoId}` : initialUrl ?? '');
  const [videoId, setVideoId] = useState<string | null>(editTrack?.videoId ?? null);
  const [title, setTitle] = useState(editTrack?.title ?? '');
  const [artist, setArtist] = useState(editTrack?.artist ?? '');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    editTrack ? 'ready' : 'idle',
  );
  const [previewError, setPreviewError] = useState<string>();
  const [comment, setComment] = useState(editTrack?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  // 클립보드에 유튜브 링크가 있으면 노출하는 원탭 칩 (네이티브 전용)
  const [clipHint, setClipHint] = useState<string | null>(null);
  // 삭제 2단 확인 (Alert은 웹에서 다중 버튼이 불안정 → 인라인 확인으로)
  const [confirmDelete, setConfirmDelete] = useState(false);

  // oEmbed/iTunes 경합 방지 — 마지막 요청만 반영 (입력이 빠르면 이전 응답이 늦게 와 뒤덮는다)
  const reqId = useRef(0);

  const onChangeUrl = async (text: string) => {
    setUrl(text);
    setClipHint(null); // 직접 입력하면 붙여넣기 칩은 필요 없다
    const id = extractVideoId(text.trim());
    if (!id) {
      setVideoId(null);
      setPreviewStatus(text.trim() ? 'error' : 'idle');
      setPreviewError('유튜브 링크가 아닌 것 같아요');
      return;
    }
    const my = ++reqId.current;
    setPreviewStatus('loading');
    try {
      const m = await fetchVideoMeta(id);
      if (my !== reqId.current) return; // 더 최신 입력이 있으면 버린다
      const parsed = parseTitle(m.title, m.author);
      setVideoId(m.videoId);
      setTitle(parsed.title.slice(0, FIELD_MAX));
      setArtist(parsed.artist.slice(0, FIELD_MAX));
      setPreviewStatus('ready');

      // iTunes 보정 — best-effort, 텍스트만. 실패하면 휴리스틱 값을 유지한다.
      const query = parsed.artist ? `${parsed.artist} ${parsed.title}` : m.title;
      const hit = await searchTrack(query);
      if (my !== reqId.current || !hit) return; // stale이거나 결과 없으면 그대로 둔다
      setTitle(hit.title.slice(0, FIELD_MAX));
      setArtist(hit.artist.slice(0, FIELD_MAX));
    } catch {
      if (my !== reqId.current) return;
      setVideoId(null);
      setPreviewStatus('error');
      setPreviewError('없는 영상이거나 비공개예요');
    }
  };

  // 마운트 시: initialUrl이 있으면 프리필, 없으면 클립보드에 유튜브 링크가 있는지 살핀다.
  useEffect(() => {
    if (editTrack) return; // 수정 모드: 저장값 유지 (자동 파싱·클립보드 감지 안 함)
    if (initialUrl) {
      onChangeUrl(initialUrl);
      return;
    }
    // 웹은 clipboard.readText가 사용자 제스처를 요구할 수 있어 자동 감지를 건너뛴다(붙여넣기 버튼으로).
    if (Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const text = (await Clipboard.getStringAsync()).trim();
        if (alive && text && extractVideoId(text)) setClipHint(text);
      } catch {
        // 클립보드 접근 실패는 조용히 무시 — 붙여넣기 버튼이 폴백이다
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) onChangeUrl(text);
  };

  const commentError = fieldError(CommentSchema, comment);
  const isReady = previewStatus === 'ready' && !!videoId;
  const titleError = isReady ? fieldError(TitleSchema, title) : null;
  const artistError = isReady ? fieldError(ArtistSchema, artist) : null;
  const canSubmit = isReady && !commentError && !titleError && !artistError && !submitting;

  const submit = async () => {
    if (!canSubmit || !videoId) return;
    setSubmitting(true);
    try {
      if (editTrack) {
        await updateTrack({
          roomId,
          videoId,
          comment: comment.trim(),
          title: title.trim(),
          artist: artist.trim(),
        });
      } else {
        await registerTrack({
          roomId,
          videoId,
          comment: comment.trim(),
          nickname,
          title: title.trim(),
          artist: artist.trim(),
        });
      }
      router.back(); // 홈 구독이 즉시 반영한다
    } catch (e: unknown) {
      if (!editTrack && isAlreadyRegistered(e)) {
        // 에러가 아니라 분기 — 오늘 이미 올렸다 (수정 모드가 아닌데 문서가 있으면)
        toast('오늘은 이미 곡을 올렸어요');
        router.back();
        return;
      }
      toast(toMessage(e, editTrack ? 'updateTrack' : 'registerTrack'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true); // 첫 탭 = 확인 요청, 두 번째 탭 = 실제 삭제
      return;
    }
    setSubmitting(true);
    try {
      await deleteTrack(roomId);
      toast('곡을 삭제했어요');
      router.back();
    } catch (e: unknown) {
      toast(toMessage(e, 'deleteTrack'));
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

        {/* 클립보드 자동 감지 칩 — 복사한 링크가 있으면 원탭으로 채운다 */}
        {!!clipHint && !url && (
          <PressableScale
            style={styles.clipChip}
            onPress={() => onChangeUrl(clipHint)}
            accessibilityRole="button"
            accessibilityLabel="복사한 링크 붙여넣기"
          >
            <Icon name="clipboard" size={size.icon} color={colors.text} />
            <Text style={[typography.caption, styles.clipChipText]} numberOfLines={1}>
              복사한 링크 붙여넣기
            </Text>
          </PressableScale>
        )}
      </View>

      <VideoPreview
        status={previewStatus}
        videoId={videoId}
        title={title}
        artist={artist}
        onChangeTitle={setTitle}
        onChangeArtist={setArtist}
        titleError={titleError}
        artistError={artistError}
        errorText={previewError}
      />

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
        accessibilityLabel={editTrack ? '곡 수정하기' : '곡 등록하기'}
      >
        {submitting ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={[typography.bodyMedium, styles.submitText]}>
            {editTrack ? '수정하기' : '등록하기'}
          </Text>
        )}
      </PressableScale>

      {/* 수정 모드에서만 삭제 — 인라인 2단 확인 */}
      {editTrack && (
        <PressableScale
          style={styles.deleteBtn}
          onPress={remove}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={confirmDelete ? '삭제 확정하기' : '곡 삭제'}
        >
          <Text style={[typography.bodyMedium, styles.deleteText]}>
            {confirmDelete ? '한 번 더 누르면 삭제돼요' : '곡 삭제'}
          </Text>
        </PressableScale>
      )}
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
  clipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: size.touch,
    backgroundColor: colors.white10,
    borderRadius: radius.full,
  },
  clipChipText: { color: colors.text },
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
  deleteBtn: {
    minHeight: size.ctaSm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  deleteText: { color: colors.danger },
});
