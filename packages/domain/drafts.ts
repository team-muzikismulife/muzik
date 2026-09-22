import { UUID, validDate, validatePayload, type Action } from "./index.ts";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}
export interface SaveIntent {
  id: string;
  action: "registerTrack" | "updateTrack";
  payload: Record<string, string>;
}
export interface Draft {
  version: 1;
  uid: string;
  roomId: string;
  dateKey: string;
  mode: "new" | "edit";
  trackId?: string;
  link: string;
  comment: string;
  updatedAt: number;
  intent?: SaveIntent;
}
export function draftKey(
  d: Pick<Draft, "uid" | "roomId" | "dateKey" | "mode" | "trackId">,
) {
  return `muzik:${d.uid}:draft:${d.roomId}:${d.dateKey}:${d.mode}:${d.trackId || "new"}`;
}
export function validDraft(v: unknown): v is Draft {
  if (!v || typeof v !== "object") return false;
  const d = v as Draft;
  if (
    d.version !== 1 ||
    !UUID.test(d.uid) ||
    !UUID.test(d.roomId) ||
    !validDate(d.dateKey) ||
    !["new", "edit"].includes(d.mode) ||
    typeof d.link !== "string" ||
    d.link.length > 2048 ||
    typeof d.comment !== "string" ||
    d.comment.length > 30 ||
    !Number.isFinite(d.updatedAt) ||
    (d.mode === "edit" && !UUID.test(d.trackId || ""))
  )
    return false;
  if (d.intent) {
    try {
      if (
        !UUID.test(d.intent.id) ||
        d.intent.action !==
          (d.mode === "edit" ? "updateTrack" : "registerTrack")
      )
        return false;
      const p = validatePayload(d.intent.action as Action, d.intent.payload);
      if (
        p.roomId !== d.roomId ||
        p.dateKey !== d.dateKey ||
        (d.mode === "edit" && p.trackId !== d.trackId)
      )
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
export function saveDraft(store: StorageLike, draft: Draft) {
  if (!validDraft(draft)) throw new Error("초안 형식이 올바르지 않아요.");
  store.setItem(draftKey(draft), JSON.stringify(draft));
}
export function loadDraft(
  store: StorageLike,
  scope: Pick<Draft, "uid" | "roomId" | "dateKey" | "mode" | "trackId">,
): Draft | null {
  try {
    const d = JSON.parse(store.getItem(draftKey(scope)) || "null");
    return validDraft(d) && draftKey(d) === draftKey(scope) ? d : null;
  } catch {
    return null;
  }
}
export function listDrafts(
  store: StorageLike,
  uid: string,
  room: string,
): Draft[] {
  const found: Draft[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(`muzik:${uid}:draft:${room}:`)) continue;
    try {
      const d = JSON.parse(store.getItem(key) || "null");
      if (
        validDraft(d) &&
        d.uid === uid &&
        d.roomId === room &&
        draftKey(d) === key
      )
        found.push(d);
    } catch {
      /* Ignore damaged local content. */
    }
  }
  return found.sort((a, b) => b.updatedAt - a.updatedAt);
}
