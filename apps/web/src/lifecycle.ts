import { useEffect, useSyncExternalStore } from "react";
type Guard = { busy: boolean; unsafe: boolean; editing: boolean };
const guards = new Map<string, Guard>();
const listeners = new Set<() => void>();
let snapshot: Guard = { busy: false, unsafe: false, editing: false };
function update() {
  const values = [...guards.values()];
  snapshot = {
    busy: values.some((v) => v.busy),
    unsafe: values.some((v) => v.unsafe),
    editing: values.some((v) => v.editing),
  };
  listeners.forEach((fn) => fn());
}
export function useUpdateGuard(key: string, guard: Guard) {
  useEffect(() => {
    guards.set(key, guard);
    update();
    return () => {
      guards.delete(key);
      update();
    };
  }, [key, guard.busy, guard.unsafe, guard.editing]);
}
export function useUpdateSafety() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => snapshot,
  );
}
export function useOnline() {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener("online", fn);
      window.addEventListener("offline", fn);
      return () => {
        window.removeEventListener("online", fn);
        window.removeEventListener("offline", fn);
      };
    },
    () => navigator.onLine,
  );
}
