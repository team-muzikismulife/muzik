import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardPaste, RotateCcw } from "lucide-react";
import {
  CommandError,
  extractVideoId,
  todayKey,
  type Video,
} from "../../../../packages/domain/index";
import {
  draftKey,
  loadDraft,
  saveDraft,
  listDrafts,
  type Draft,
  type SaveIntent,
} from "../../../../packages/domain/drafts";
import { command, type Track } from "../backend";
import { useToday } from "../hooks";
import { useSession } from "../session";
import { ErrorText } from "../components/ui";
import s from "../App.module.css";

export default function TrackEditor({
  roomId,
  date,
  mode,
  track,
  expectedId,
}: {
  roomId: string;
  date: string;
  mode: "new" | "edit";
  track?: Track;
  expectedId?: string;
}) {
  const { session } = useSession();
  const uid = session!.user.id;
  const navigate = useNavigate();
  const cache = useQueryClient();
  const location = useLocation();
  const today = useToday();
  const [draft, setDraft] = useState<Draft>(() => {
    const scope = {
      uid,
      roomId,
      dateKey: date,
      mode,
      trackId: mode === "edit" ? (expectedId ?? track?.id) : undefined,
    };
    return (
      loadDraft(localStorage, scope) ?? {
        ...scope,
        version: 1,
        link:
          mode === "edit" && track ? `https://youtu.be/${track.video_id}` : "",
        comment: mode === "edit" ? (track?.comment ?? "") : "",
        updatedAt: Date.now(),
      }
    );
  });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [video, setVideo] = useState<Video | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState(false);
  const [retry, setRetry] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const videoId = extractVideoId(draft.link);
  const oldDay = date !== today;
  const editing = mode === "edit";
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const changedTrack =
    editing && (!track || track.id !== draft.trackId || track.hidden);
  const locked = Boolean(draft.intent) || pending;
  const persist = (next: Draft) => {
    draftRef.current = next;
    setDraft(next);
    try {
      saveDraft(localStorage, next);
      setStorageError(false);
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  };
  const change = (patch: Partial<Draft>) => {
    setError(null);
    persist({ ...draftRef.current, ...patch, updatedAt: Date.now() });
  };
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const version = ++generation.current;
    setVideo(null);
    setPreviewError(null);
    setPreviewing(false);
    if (!videoId || !online || draft.intent) return;
    const timer = setTimeout(() => {
      setPreviewing(true);
      void command<Video>(
        "previewTrack",
        { roomId, videoId },
        crypto.randomUUID(),
      )
        .then((value) => {
          if (generation.current === version) setVideo(value);
        })
        .catch((cause) => {
          if (generation.current === version) setPreviewError(cause as Error);
        })
        .finally(() => {
          if (generation.current === version) setPreviewing(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [videoId, roomId, online, retry, Boolean(draft.intent)]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (inFlight.current || !online) return;
    const previous = draftRef.current;
    if (
      !previous.intent &&
      (!video || video.videoId !== videoId || oldDay || changedTrack)
    )
      return;
    const intent: SaveIntent = previous.intent ?? {
      id: crypto.randomUUID(),
      action: editing ? "updateTrack" : "registerTrack",
      payload: {
        roomId,
        dateKey: date,
        videoId: video!.videoId,
        comment: previous.comment.trim(),
        ...(editing ? { trackId: previous.trackId! } : {}),
      },
    };
    // Persist the exact operation before sending, so a lost response can be replayed after reload.
    if (!persist({ ...previous, intent, updatedAt: Date.now() })) {
      setError(
        new Error(
          "저장 요청을 안전하게 보관하지 못했어요. 브라우저 저장 공간을 확인해 주세요.",
        ),
      );
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await command(intent.action, intent.payload, intent.id);
      if (!active.current) return;
      localStorage.removeItem(draftKey(previous));
      await cache.invalidateQueries({ queryKey: ["room", uid, roomId] });
      await cache.invalidateQueries({ queryKey: ["teams", uid] });
      navigate(`/room/${roomId}?date=${result.dateKey}`, { replace: true });
    } catch (cause) {
      if (!active.current) return;
      const err = cause as Error;
      setError(err);
      if (
        err instanceof CommandError &&
        !["UNAVAILABLE", "UNAUTHENTICATED", "RATE_LIMITED"].includes(err.code)
      )
        persist({ ...draftRef.current, intent: undefined });
      if (
        err instanceof CommandError &&
        [
          "ALREADY_EXISTS",
          "TRACK_CHANGED",
          "NOT_FOUND",
          "HIDDEN_TRACK",
        ].includes(err.code)
      )
        await cache.invalidateQueries({ queryKey: ["room", uid, roomId] });
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  };
  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText();
      change({ link: value.slice(0, 2048) });
      setTouched(false);
    } catch {
      setError(
        new Error("붙여넣기를 사용할 수 없어요. 링크를 직접 입력해 주세요."),
      );
      document.getElementById("video-link")?.focus();
    }
  };
  const transfer = () => {
    if (
      draft.intent ||
      editing ||
      !window.confirm("지난 초안을 오늘의 새 곡으로 가져올까요?")
    )
      return;
    const next: Draft = {
      ...draft,
      dateKey: today,
      mode: "new",
      trackId: undefined,
      intent: undefined,
      updatedAt: Date.now(),
    };
    if (
      loadDraft(localStorage, next) &&
      !window.confirm("오늘 작성하던 초안이 있어요. 지난 초안으로 바꿀까요?")
    )
      return;
    try {
      saveDraft(localStorage, next);
      navigate(`/room/${roomId}/track/new?date=${today}`, { replace: true });
    } catch {
      setStorageError(true);
    }
  };
  const oldDrafts =
    mode === "new" && !oldDay
      ? listDrafts(localStorage, uid, roomId).filter((d) => d.dateKey < today)
      : [];
  return (
    <section className={s.stack}>
      <Link className={s.textAction} to={`/room/${roomId}?date=${date}`}>
        <ArrowLeft size={18} />
        팀으로
      </Link>
      <h1>{editing ? "내 곡 수정" : "오늘의 한 곡"}</h1>
      {oldDay && (
        <div className={s.notice} role="status">
          <p>
            {date} 초안을 보관하고 있어요. 지난 날짜의 곡은 변경할 수 없어요.
          </p>
          {!editing && !draft.intent && (
            <button className={s.secondary} onClick={transfer}>
              오늘의 초안으로 가져오기
            </button>
          )}
        </div>
      )}
      {changedTrack && (
        <p className={s.notice}>
          수정하던 곡이 삭제되거나 바뀌었어요. 초안은 보관하며 새 곡에 덮어쓰지
          않아요.
        </p>
      )}
      {!editing && track && !draft.intent && (
        <div className={s.notice}>
          <p>이 날짜에는 이미 내 곡이 있어요.</p>
          <Link
            className={s.secondary}
            to={`/room/${roomId}/track/edit?date=${date}&track=${track.id}`}
          >
            현재 내 곡 수정
          </Link>
        </div>
      )}
      {!online && (
        <p className={s.notice} role="status">
          오프라인이에요. 초안만 이 기기에 보관하며 자동으로 등록하지 않아요.
        </p>
      )}
      {storageError && (
        <p className={s.error} role="alert">
          기기에 초안을 보관하지 못했어요. 이 화면을 닫기 전에 브라우저 저장
          공간을 확인해 주세요.
        </p>
      )}
      {draft.intent && (
        <p className={s.notice} role="status">
          저장 결과가 아직 확인되지 않았어요. 같은 요청으로 결과를 확인한 뒤
          수정할 수 있어요.
        </p>
      )}
      <form onSubmit={save} aria-busy={pending}>
        <div className={s.field}>
          <label htmlFor="video-link">YouTube 링크</label>
          <div className={s.inputRow}>
            <input
              id="video-link"
              value={draft.link}
              disabled={locked}
              onChange={(e) => {
                change({ link: e.target.value });
                setTouched(false);
              }}
              onBlur={() => setTouched(true)}
              maxLength={2048}
              inputMode="url"
              autoComplete="off"
              aria-invalid={touched && Boolean(draft.link) && !videoId}
              aria-describedby="link-error"
              placeholder="https://youtu.be/..."
            />
            <button
              className={s.icon}
              type="button"
              disabled={locked}
              onClick={() => void paste()}
              title="링크 붙여넣기"
              aria-label="링크 붙여넣기"
            >
              <ClipboardPaste size={20} />
            </button>
          </div>
          {touched && draft.link && !videoId && (
            <p id="link-error" className={s.error}>
              YouTube 영상 링크를 확인해 주세요.
            </p>
          )}
        </div>
        {previewing && <p role="status">영상 확인 중</p>}
        {previewError && (
          <div>
            <ErrorText error={previewError} />
            <button
              type="button"
              className={s.textAction}
              disabled={!online}
              onClick={() => setRetry((n) => n + 1)}
            >
              <RotateCcw size={16} />
              영상 다시 확인
            </button>
          </div>
        )}
        {video && (
          <div className={s.preview}>
            <img
              src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
              alt=""
            />
            <div>
              <h2>{video.title}</h2>
              <p className={s.muted}>{video.artist}</p>
            </div>
          </div>
        )}
        <label>
          추천하는 이유 <small>선택 사항</small>
          <textarea
            value={draft.comment}
            disabled={locked}
            onChange={(e) => change({ comment: e.target.value })}
            maxLength={30}
            rows={3}
          />
          <small>{draft.comment.length}/30</small>
        </label>
        <ErrorText error={error} />
        <button
          className={s.primary}
          disabled={
            pending ||
            !online ||
            (!draft.intent &&
              (!video ||
                previewing ||
                oldDay ||
                changedTrack ||
                (!editing && Boolean(track))))
          }
        >
          {pending
            ? "저장 결과 확인 중"
            : draft.intent
              ? "저장 결과 확인"
              : editing
                ? "수정 완료"
                : "곡 등록하기"}
        </button>
      </form>
      {!!oldDrafts.length && (
        <section className={s.section}>
          <h2>보관한 지난 초안</h2>
          {oldDrafts.map((d) => (
            <Link
              className={s.textAction}
              key={draftKey(d)}
              to={`/room/${roomId}/track/${d.mode}?date=${d.dateKey}${d.trackId ? `&track=${d.trackId}` : ""}`}
            >
              {d.dateKey} · {d.mode === "edit" ? "수정 초안" : "새 곡 초안"}
              {d.intent ? " · 결과 확인 필요" : ""}
            </Link>
          ))}
        </section>
      )}
    </section>
  );
}
