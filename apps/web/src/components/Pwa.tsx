import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, Copy, RefreshCw, X } from "lucide-react";
import {
  installMode,
  maySuggestInstall,
} from "../../../../packages/domain/install";
import { useSession } from "../session";
import { supabase } from "../backend";
import { readLocal, writeLocal } from "../local";
import { useOnline, useUpdateSafety } from "../lifecycle";
import { useToday } from "../hooks";
import { recordMetric } from "../metrics";
import { ErrorText } from "./ui";
import s from "../App.module.css";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const Context = createContext({ open: () => {}, installed: false });
export const firstTrackSaved = (uid: string) => {
  try {
    writeLocal(`muzik:${uid}:first-track`, true);
    window.dispatchEvent(new Event("muzik-first-track"));
  } catch {
    /* Optional suggestion. */
  }
};
export function PwaProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const online = useOnline();
  const day = useToday();
  const [installed, setInstalled] = useState(
    () =>
      matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const mode = installMode({
    origin: location.origin,
    configuredOrigin: import.meta.env.VITE_PUBLIC_ORIGIN || "",
    connected: Boolean(supabase),
    installed,
    userAgent: navigator.userAgent,
    prompt: Boolean(prompt),
  });
  const open = () => {
    opener.current = document.activeElement as HTMLElement;
    setOpened(true);
    setError(null);
    recordMetric(uid, "install_open");
  };
  const close = () => {
    try {
      writeLocal("muzik:install-dismissed", Date.now());
    } catch {}
    setOpened(false);
    opener.current?.focus();
  };
  useEffect(() => {
    const before = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setOpened(false);
      setPrompt(null);
    };
    const media = matchMedia("(display-mode: standalone)");
    const display = () => {
      if (media.matches) done();
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    media.addEventListener("change", display);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener("change", display);
    };
  }, []);
  useEffect(() => {
    recordMetric(uid, "visit");
    if (
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
      recordMetric(uid, "standalone");
  }, [uid, day, online, installed]);
  useEffect(() => {
    const suggest = () => {
      if (!uid || mode === "installed" || mode === "unavailable") return;
      if (
        maySuggestInstall(
          readLocal(`muzik:${uid}:first-track`, false),
          readLocal(`muzik:${uid}:install-suggested`, false),
          readLocal("muzik:install-dismissed", 0),
          Date.now(),
        )
      ) {
        try {
          writeLocal(`muzik:${uid}:install-suggested`, true);
        } catch {
          return;
        }
        open();
      }
    };
    suggest();
    window.addEventListener("muzik-first-track", suggest);
    return () => window.removeEventListener("muzik-first-track", suggest);
  }, [uid, mode, day]);
  useEffect(() => {
    if (opened) document.getElementById("install-heading")?.focus();
  }, [opened]);
  return (
    <Context.Provider value={{ open, installed }}>
      {children}
      {opened && !installed && (
        <section className={s.installPanel} aria-labelledby="install-heading">
          <div className={s.between}>
            <h2 id="install-heading" tabIndex={-1}>
              홈 화면에 MUZIK
            </h2>
            <button
              className={s.icon}
              aria-label="설치 안내 닫기"
              onClick={close}
            >
              <X />
            </button>
          </div>
          {mode === "unavailable" ? (
            <p className={s.notice}>
              정식 주소와 서비스 연결을 준비 중이에요. 이 미리보기에서는
              설치하지 마세요.
            </p>
          ) : mode === "embedded" ? (
            <>
              <p>Safari 또는 Chrome에서 이 링크를 열어 주세요.</p>
              <button
                className={s.secondary}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(location.href)
                    .catch(() =>
                      setError(
                        new Error(
                          "링크를 복사하지 못했어요. 브라우저 주소를 직접 복사해 주세요.",
                        ),
                      ),
                    )
                }
              >
                <Copy size={18} />
                링크 복사
              </button>
            </>
          ) : mode === "ios" ? (
            <p>
              Safari의 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택한 뒤 ‘추가’를
              눌러 주세요.
            </p>
          ) : mode === "prompt" ? (
            <button
              className={s.primary}
              disabled={busy || accepted}
              onClick={async () => {
                if (!prompt) return;
                setBusy(true);
                try {
                  await prompt.prompt();
                  const choice = await prompt.userChoice;
                  if (choice.outcome === "accepted") {
                    setAccepted(true);
                    recordMetric(uid, "install_accepted");
                  } else close();
                  setPrompt(null);
                } catch {
                  setError(
                    new Error(
                      "설치를 시작하지 못했어요. 브라우저 메뉴에서 설치를 확인해 주세요.",
                    ),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={18} />홈 화면에 추가
            </button>
          ) : (
            <p>
              브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 확인해 주세요.
              지원하지 않으면 웹에서 계속 이용할 수 있어요.
            </p>
          )}
          {accepted && (
            <p role="status">
              설치 요청을 수락했어요. 설치 완료 여부는 브라우저에서 확인해
              주세요.
            </p>
          )}
          <ErrorText error={error} />
        </section>
      )}
    </Context.Provider>
  );
}
export function InstallEntry() {
  const pwa = useContext(Context);
  return pwa.installed ? null : (
    <button className={s.textAction} onClick={pwa.open}>
      <Download size={18} />
      설치 안내
    </button>
  );
}
export function AppUpdate() {
  const safety = useUpdateSafety();
  const online = useOnline();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [changed, setChanged] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const consent = useRef(false);
  const currentSafety = useRef(safety);
  currentSafety.current = safety;
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    let reg: ServiceWorkerRegistration | undefined;
    const inspect = () => {
      if (alive && reg?.waiting) {
        setWaiting(reg.waiting);
        setDeferred(false);
      }
    };
    const found = () => {
      const worker = reg?.installing;
      worker?.addEventListener("statechange", inspect);
    };
    const controlled = () => {
      if (!alive) return;
      if (
        consent.current &&
        !currentSafety.current.busy &&
        !currentSafety.current.unsafe
      )
        location.reload();
      else {
        setChanged(true);
        setDeferred(false);
      }
    };
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void reg?.update().catch(() => {});
    };
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (!alive) return;
        inspect();
        r.addEventListener("updatefound", found);
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", controlled);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      reg?.removeEventListener("updatefound", found);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controlled,
      );
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (!waiting && !changed) return null;
  return (
    <aside className={s.section} aria-label="앱 업데이트">
      <h2>새 버전이 준비됐어요</h2>
      {deferred ? (
        <button className={s.textAction} onClick={() => setDeferred(false)}>
          업데이트 안내 열기
        </button>
      ) : (
        <>
          <p className={s.notice}>
            {safety.busy
              ? "저장 결과를 확인하는 중이에요. 현재 요청이 끝나면 업데이트할 수 있어요."
              : safety.unsafe
                ? "초안을 기기에 보관하지 못해 업데이트를 잠시 막았어요."
                : "초안과 확인되지 않은 저장 요청은 이 기기에 보관돼요."}
          </p>
          <div className={s.actions}>
            <button className={s.secondary} onClick={() => setDeferred(true)}>
              나중에
            </button>
            <button
              className={s.primary}
              disabled={safety.busy || safety.unsafe || applying || !online}
              onClick={() => {
                if (!confirm("초안을 유지하고 새 버전을 적용할까요?")) return;
                consent.current = true;
                setApplying(true);
                if (changed && !waiting) location.reload();
                else {
                  waiting?.postMessage({ type: "SKIP_WAITING" });
                  setTimeout(() => {
                    setApplying(false);
                    setError(
                      new Error(
                        "적용이 지연되고 있어요. 작업은 유지되며 다시 시도할 수 있어요.",
                      ),
                    );
                  }, 12000);
                }
              }}
            >
              <RefreshCw size={18} />
              {applying ? "적용 중" : "업데이트"}
            </button>
          </div>
          <ErrorText error={error} />
        </>
      )}
    </aside>
  );
}
