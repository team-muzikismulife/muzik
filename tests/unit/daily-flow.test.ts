import { describe, it, expect } from "vitest";
import {
  playbackReducer,
  initialPlayback,
  type Playback,
} from "../../packages/domain/player";
import {
  saveDraft,
  loadDraft,
  listDrafts,
  draftKey,
  type Draft,
} from "../../packages/domain/drafts";
class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
}
const queue = (ids: string[]) =>
  playbackReducer(initialPlayback, { type: "queue", ids });
const select = (s: Playback, id: string) =>
  playbackReducer(s, { type: "select", id });
describe("추천 기록 기준 재생", () => {
  it("같은 영상을 가진 서로 다른 추천도 끝까지 각각 재생", () => {
    let s = select(queue(["record-a", "record-b"]), "record-a");
    s = playbackReducer(s, {
      type: "ended",
      id: "record-a",
      generation: s.generation,
    });
    expect(s.currentId).toBe("record-b");
    s = playbackReducer(s, {
      type: "ended",
      id: "record-b",
      generation: s.generation,
    });
    expect(s.status).toBe("ended");
    expect(s.currentId).toBeNull();
    expect(playbackReducer(s, { type: "restart" }).currentId).toBe("record-a");
  });
  it("전곡 실패 뒤 반복 중단", () => {
    let s = select(queue(["a", "b"]), "a");
    s = playbackReducer(s, {
      type: "error",
      id: "a",
      generation: s.generation,
    });
    s = playbackReducer(s, {
      type: "error",
      id: "b",
      generation: s.generation,
    });
    expect(s.status).toBe("failed");
    expect(s.currentId).toBeNull();
    expect(s.failed).toEqual(["a", "b"]);
  });
  it("갱신은 선택 유지, 삭제는 다음 기존 기록, 지난 이벤트 무시", () => {
    let s = select(queue(["a", "b", "c"]), "b");
    const oldGeneration = s.generation;
    s = playbackReducer(s, { type: "queue", ids: ["x", "a", "b", "c"] });
    expect(s.currentId).toBe("b");
    s = playbackReducer(s, { type: "queue", ids: ["x", "a", "c"] });
    expect(s.currentId).toBe("c");
    expect(
      playbackReducer(s, { type: "ended", id: "b", generation: oldGeneration }),
    ).toBe(s);
  });
  it("일시정지 중 숨김에도 자동 재생하지 않음", () => {
    let s = select(queue(["a", "b"]), "a");
    s = playbackReducer(s, {
      type: "state",
      id: "a",
      generation: s.generation,
      status: "paused",
    });
    s = playbackReducer(s, { type: "queue", ids: ["b"] });
    expect(s.currentId).toBe("b");
    expect(s.status).toBe("paused");
  });
  it("삭제후 재등록된 새 id를 과거 항목으로 착각하지 않음", () => {
    let s = select(queue(["old"]), "old");
    s = playbackReducer(s, { type: "queue", ids: ["new"] });
    expect(s.currentId).toBeNull();
    expect(s.status).toBe("ended");
  });
});
describe("초안과 저장 의도", () => {
  const uid = crypto.randomUUID(),
    roomId = crypto.randomUUID();
  const make = (): Draft => ({
    version: 1,
    uid,
    roomId,
    dateKey: "2026-09-21",
    mode: "new",
    link: "https://youtu.be/dQw4w9WgXcQ",
    comment: "함께 들어요",
    updatedAt: 1,
  });
  it("페이지 재실행도 동일 저장 ID/원래 날짜/입력 보존", () => {
    const store = new MemoryStorage();
    const d = make();
    d.intent = {
      id: crypto.randomUUID(),
      action: "registerTrack",
      payload: {
        roomId,
        dateKey: d.dateKey,
        videoId: "dQw4w9WgXcQ",
        comment: d.comment,
      },
    };
    saveDraft(store, d);
    expect(loadDraft(store, d)).toEqual(d);
    expect(listDrafts(store, uid, roomId)).toEqual([d]);
  });
  it("다른 계정·팀·날짜·수정기록에 초안 노출 안 함", () => {
    const store = new MemoryStorage();
    const d = make();
    saveDraft(store, d);
    expect(loadDraft(store, { ...d, uid: crypto.randomUUID() })).toBeNull();
    expect(loadDraft(store, { ...d, dateKey: "2026-09-22" })).toBeNull();
    expect(listDrafts(store, uid, crypto.randomUUID())).toEqual([]);
  });
  it("수정 초안을 신규 저장으로 바꾸거나 다른 날짜로 재사용 거부", () => {
    const store = new MemoryStorage();
    const d: Draft = { ...make(), mode: "edit", trackId: crypto.randomUUID() };
    d.intent = {
      id: crypto.randomUUID(),
      action: "registerTrack",
      payload: {
        roomId,
        dateKey: d.dateKey,
        videoId: "dQw4w9WgXcQ",
        comment: "",
      },
    };
    expect(() => saveDraft(store, d)).toThrow();
  });
  it("잘못된 로컬 JSON과 과도한 내용은 사용하지 않음", () => {
    const store = new MemoryStorage();
    const d = make();
    store.setItem(draftKey(d), "{");
    expect(loadDraft(store, d)).toBeNull();
    expect(() =>
      saveDraft(store, { ...d, comment: "가".repeat(31) }),
    ).toThrow();
  });
});
