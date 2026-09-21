import { useEffect, useReducer, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import {
  initialPlayback,
  playbackReducer,
} from "../../../../packages/domain/player";
import type { Track, Member } from "../backend";
import s from "../App.module.css";

interface YoutubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}
interface YoutubeAPI {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YoutubePlayer;
}
declare global {
  interface Window {
    YT?: YoutubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<YoutubeAPI> | undefined;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise)
    apiPromise = new Promise<YoutubeAPI>((resolve, reject) => {
      const timeout = setTimeout(() => {
        apiPromise = undefined;
        reject(new Error("플레이어 연결을 확인해 주세요."));
      }, 12000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        clearTimeout(timeout);
        if (window.YT) resolve(window.YT);
      };
      let script = document.querySelector<HTMLScriptElement>(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      if (!script) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.append(script);
      }
      script.onerror = () => {
        clearTimeout(timeout);
        script?.remove();
        apiPromise = undefined;
        reject(new Error("플레이어에 연결하지 못했어요."));
      };
    });
  return apiPromise;
}
function VideoFrame({
  track,
  autoplay,
  onEvent,
  controller,
}: {
  track: Track;
  autoplay: boolean;
  onEvent: (event: "playing" | "paused" | "ended" | "error") => void;
  controller: React.RefObject<YoutubePlayer | null>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const events = useRef(onEvent);
  events.current = onEvent;
  const shouldPlay = useRef(autoplay);
  shouldPlay.current = autoplay;
  useEffect(() => {
    let active = true;
    let player: YoutubePlayer | undefined;
    const slot = document.createElement("div");
    mount.current?.append(slot);
    void loadAPI()
      .then((api) => {
        if (!active) return;
        player = new api.Player(slot, {
          width: "100%",
          height: "100%",
          videoId: track.video_id,
          playerVars: { playsinline: 1, origin: location.origin, autoplay: 0 },
          events: {
            onReady: () => {
              if (active) {
                controller.current = player!;
                if (shouldPlay.current) player?.playVideo();
                else events.current("paused");
              }
            },
            onStateChange: (e: { data: number }) => {
              if (!active) return;
              if (e.data === 1) events.current("playing");
              else if (e.data === 2 || e.data === 5) events.current("paused");
              else if (e.data === 0) events.current("ended");
            },
            onAutoplayBlocked: () => {
              if (active) events.current("paused");
            },
            onError: () => {
              if (active) events.current("error");
            },
          },
        });
      })
      .catch(() => {
        if (active) events.current("error");
      });
    return () => {
      active = false;
      controller.current = null;
      player?.destroy();
      slot.remove();
    };
  }, [track.id, track.video_id]);
  return (
    <div className={s.playerFrame} ref={mount} aria-label="YouTube 플레이어" />
  );
}
export default function Player({
  tracks,
  members,
  startId,
}: {
  tracks: Track[];
  members: Member[];
  startId?: string;
}) {
  const [state, dispatch] = useReducer(playbackReducer, {
    ...initialPlayback,
    queue: tracks.map((t) => t.id),
  });
  const controller = useRef<YoutubePlayer | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const ids = tracks.map((t) => t.id).join(",");
  useEffect(
    () => dispatch({ type: "queue", ids: tracks.map((t) => t.id) }),
    [ids],
  );
  useEffect(() => {
    if (startId) dispatch({ type: "select", id: startId });
  }, [startId]);
  useEffect(() => {
    if (offline) controller.current?.pauseVideo();
  }, [offline]);
  const current = tracks.find((t) => t.id === state.currentId);
  const labels = {
    idle: "들을 곡을 골라 주세요",
    preparing: "재생 준비 중",
    playing: "재생 중",
    paused: "일시정지",
    ended: "모두 들었어요",
    failed: "재생을 마쳤어요",
  };
  const event = (kind: "playing" | "paused" | "ended" | "error") => {
    if (!current) return;
    dispatch(
      kind === "playing" || kind === "paused"
        ? {
            type: "state",
            status: kind,
            id: current.id,
            generation: state.generation,
          }
        : { type: kind, id: current.id, generation: state.generation },
    );
  };
  return (
    <section className={s.player} aria-label="모아듣기">
      <div className={s.between}>
        <h2>모아듣기</h2>
        <span role="status">
          {offline ? "오프라인 · 재생 불가" : labels[state.status]}
        </span>
      </div>
      {current && (
        <>
          <p>
            {members.find((m) => m.user_id === current.user_id)?.nickname}님의
            추천
          </p>
          <VideoFrame
            key={`${current.id}:${current.video_id}:${state.generation}`}
            track={current}
            autoplay={state.status !== "paused" && !offline}
            controller={controller}
            onEvent={event}
          />
          <h3>{current.title}</h3>
          <p className={s.comment}>{current.comment}</p>
        </>
      )}
      {state.notice && (
        <p role="status" className={s.notice}>
          {state.notice}
        </p>
      )}
      <div className={s.actions}>
        {current ? (
          <>
            <button
              className={s.primary}
              disabled={offline}
              onClick={() =>
                state.status === "playing"
                  ? controller.current?.pauseVideo()
                  : controller.current?.playVideo()
              }
            >
              {state.status === "playing" ? <Pause /> : <Play />}
              {state.status === "playing" ? "일시정지" : "재생"}
            </button>
            <button
              className={s.secondary}
              disabled={offline}
              onClick={() => dispatch({ type: "next" })}
            >
              <SkipForward />
              다음 곡
            </button>
          </>
        ) : (
          <button
            className={s.primary}
            disabled={!tracks.length || offline}
            onClick={() => dispatch({ type: "restart" })}
          >
            {state.status === "idle" ? <Play /> : <RotateCcw />}
            {state.status === "idle" ? "처음부터 듣기" : "다시 듣기"}
          </button>
        )}
      </div>
      {current && (
        <a
          className={s.textAction}
          href={`https://www.youtube.com/watch?v=${current.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={16} />
          YouTube에서 열기
        </a>
      )}
      <ol className={s.queue}>
        {tracks.map((t) => (
          <li key={t.id}>
            <button
              aria-current={state.currentId === t.id ? "true" : undefined}
              onClick={() => dispatch({ type: "select", id: t.id })}
              disabled={offline}
            >
              <Play size={16} />
              <span>
                {t.title}
                <small>
                  {members.find((m) => m.user_id === t.user_id)?.nickname}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
