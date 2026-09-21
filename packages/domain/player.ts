export type PlaybackStatus =
  | "idle"
  | "preparing"
  | "playing"
  | "paused"
  | "ended"
  | "failed";
export interface Playback {
  queue: string[];
  currentId: string | null;
  status: PlaybackStatus;
  failed: string[];
  notice: string;
  generation: number;
}
export type PlaybackEvent =
  | { type: "queue"; ids: string[] }
  | { type: "select"; id: string }
  | {
      type: "state";
      id: string;
      generation: number;
      status: "playing" | "paused";
    }
  | { type: "ended" | "error"; id: string; generation: number }
  | { type: "next" }
  | { type: "restart" };
export const initialPlayback: Playback = {
  queue: [],
  currentId: null,
  status: "idle",
  failed: [],
  notice: "",
  generation: 0,
};
function select(
  s: Playback,
  id: string | null,
  status: PlaybackStatus = "preparing",
): Playback {
  return {
    ...s,
    currentId: id,
    status: id ? status : status === "failed" ? "failed" : "ended",
    generation: s.generation + 1,
  };
}
function advance(s: Playback, error = false): Playback {
  const failed =
    error && s.currentId ? [...new Set([...s.failed, s.currentId])] : s.failed;
  const remaining = s.queue
    .slice(s.queue.indexOf(s.currentId || "") + 1)
    .filter((id) => !failed.includes(id));
  const next = remaining[0] ?? null;
  return {
    ...select(
      { ...s, failed },
      next,
      next ? "preparing" : error ? "failed" : "ended",
    ),
    notice: error
      ? next
        ? "이 곡을 재생하지 못해 다음 곡으로 이동했어요."
        : "더 이상 재생할 수 있는 곡이 없어요."
      : "",
  };
}
export function playbackReducer(s: Playback, e: PlaybackEvent): Playback {
  if (e.type === "queue") {
    const ids = [...new Set(e.ids)];
    if (s.currentId && !ids.includes(s.currentId)) {
      const next = s.queue
        .slice(s.queue.indexOf(s.currentId) + 1)
        .find((id) => ids.includes(id) && !s.failed.includes(id));
      const active = ["playing", "preparing", "paused"].includes(s.status);
      return {
        ...select(
          { ...s, queue: ids },
          active ? (next ?? null) : null,
          s.status === "paused" ? "paused" : "preparing",
        ),
        notice: "현재 곡이 목록에서 제외됐어요.",
      };
    }
    return { ...s, queue: ids };
  }
  if (e.type === "select")
    return s.queue.includes(e.id)
      ? { ...select(s, e.id), failed: [], notice: "" }
      : s;
  if (e.type === "restart")
    return { ...select(s, s.queue[0] ?? null), failed: [], notice: "" };
  if (e.type === "next") return advance(s);
  if (e.id !== s.currentId || e.generation !== s.generation) return s;
  if (e.type === "state") return { ...s, status: e.status };
  if (e.type === "ended") return advance(s);
  return advance(s, true);
}
