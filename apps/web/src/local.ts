import { useSyncExternalStore } from "react";
import { UUID } from "../../../packages/domain/index";
const changed = () => window.dispatchEvent(new Event("muzik-local"));
function subscribe(fn: () => void) {
  window.addEventListener("muzik-local", fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener("muzik-local", fn);
    window.removeEventListener("storage", fn);
  };
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  changed();
}
export function clearUserLocal(uid: string) {
  for (const key of Object.keys(localStorage))
    if (key.startsWith(`muzik:${uid}:`)) localStorage.removeItem(key);
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith(`muzik:${uid}:`)) sessionStorage.removeItem(key);
  changed();
}
export function touchTeam(uid: string, id: string) {
  try {
    const recent = readLocal<Record<string, number>>(`muzik:${uid}:recent`, {});
    writeLocal(`muzik:${uid}:recent`, { ...recent, [id]: Date.now() });
  } catch {
    /* 関覧は保存できなくても続ける */
  }
}
export function useHidden(uid: string, room: string) {
  const key = `muzik:${uid}:hidden:${room}`;
  const raw = useSyncExternalStore(subscribe, () => {
    try {
      return localStorage.getItem(key) || "[]";
    } catch {
      return "[]";
    }
  });
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      ids = parsed.filter((x) => typeof x === "string" && UUID.test(x));
  } catch {
    /* 破損した設定は空として扱う */
  }
  const set = (next: string[]) => writeLocal(key, [...new Set(next)]);
  return {
    ids,
    hide: (id: string) => set([...ids, id]),
    restore: (id: string) => set(ids.filter((x) => x !== id)),
    restoreAll: () => set([]),
  };
}
