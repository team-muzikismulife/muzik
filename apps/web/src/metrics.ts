import { command } from "./backend";
import { todayKey } from "../../../packages/domain/index";
export function recordMetric(
  uid: string | undefined,
  kind:
    | "visit"
    | "install_open"
    | "install_request"
    | "install_accepted"
    | "standalone",
) {
  if (!uid || !navigator.onLine) return;
  if (
    location.origin !== import.meta.env.VITE_PUBLIC_ORIGIN ||
    location.protocol !== "https:"
  )
    return;
  const key = `muzik:${uid}:metric:${todayKey()}:${kind}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "attempted");
    void command("recordEvent", { kind }, crypto.randomUUID()).catch(() => {});
  } catch {
    /* Metrics never block the product or create a retry queue. */
  }
}
