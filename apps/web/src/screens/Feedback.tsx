import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Send } from "lucide-react";
import {
  CommandError,
  UUID,
  validatePayload,
} from "../../../../packages/domain/index";
import { command } from "../backend";
import { useOnline, useUpdateGuard } from "../lifecycle";
import { ErrorText } from "../components/ui";
import s from "../App.module.css";
type Draft = {
  message: string;
  intent?: { id: string; payload: Record<string, string> };
};
export default function Feedback({
  uid,
  roomId,
}: {
  uid: string;
  roomId: string;
}) {
  const key = `muzik:${uid}:feedback:${roomId}`;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) || "null");
      if (typeof d?.message !== "string" || d.message.length > 1000)
        return { message: "" };
      if (d.intent) {
        validatePayload("sendFeedback", d.intent.payload);
        if (
          !UUID.test(d.intent.id) ||
          d.intent.payload.roomId !== roomId ||
          d.intent.payload.message !== d.message.trim()
        )
          return { message: "" };
      }
      return d;
    } catch {
      return { message: "" };
    }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [unsafe, setUnsafe] = useState(false);
  const [success, setSuccess] = useState(false);
  const sending = useRef(false);
  const online = useOnline();
  useUpdateGuard("feedback", {
    busy: pending,
    unsafe,
    editing: Boolean(draft.message),
  });
  const persist = (d: Draft) => {
    setDraft(d);
    try {
      localStorage.setItem(key, JSON.stringify(d));
      setUnsafe(false);
      return true;
    } catch {
      setUnsafe(true);
      return false;
    }
  };
  return (
    <section className={s.stack}>
      <Link className={s.textAction} to={`/room/${roomId}`}>
        <ArrowLeft size={18} />
        팀으로
      </Link>
      <h1>의견 보내기</h1>
      {success ? (
        <p role="status">의견을 받았어요. 고맙습니다.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (sending.current || !online) return;
            const next = {
              ...draft,
              intent: draft.intent ?? {
                id: crypto.randomUUID(),
                payload: { roomId, message: draft.message.trim() },
              },
            };
            if (!persist(next)) {
              setError(
                new Error(
                  "기기에 요청을 보관하지 못했어요. 저장 공간을 확인해 주세요.",
                ),
              );
              return;
            }
            sending.current = true;
            setPending(true);
            setError(null);
            try {
              await command(
                "sendFeedback",
                next.intent.payload,
                next.intent.id,
              );
              if (!active.current) return;
              localStorage.removeItem(key);
              setDraft({ message: "" });
              setSuccess(true);
            } catch (cause) {
              if (!active.current) return;
              setError(cause as Error);
              if (
                cause instanceof CommandError &&
                !["UNAVAILABLE", "UNAUTHENTICATED", "RATE_LIMITED"].includes(
                  cause.code,
                )
              )
                persist({ ...next, intent: undefined });
            } finally {
              sending.current = false;
              if (active.current) setPending(false);
            }
          }}
        >
          <div>
            <label htmlFor="feedback-message">의견</label>
            <textarea
              id="feedback-message"
              aria-describedby="feedback-count"
              rows={6}
              maxLength={1000}
              value={draft.message}
              disabled={pending || Boolean(draft.intent)}
              onChange={(e) => {
                persist({ message: e.target.value });
                setError(null);
              }}
            />
            <small id="feedback-count">{draft.message.length}/1000</small>
          </div>
          {!online && (
            <p role="status">
              오프라인이에요. 내용은 이 기기에 보관하며 자동 전송하지 않아요.
            </p>
          )}
          {draft.intent && (
            <p className={s.notice}>
              전송 결과를 아직 확인하지 못했어요. 같은 요청으로 다시 확인합니다.
            </p>
          )}
          {unsafe && <p role="alert">기기에 내용을 보관하지 못했어요.</p>}
          <ErrorText error={error} />
          <button
            className={s.primary}
            disabled={!online || pending || !draft.message.trim()}
          >
            <Send size={18} />
            {pending
              ? "전송 확인 중"
              : draft.intent
                ? "전송 결과 확인"
                : "의견 보내기"}
          </button>
        </form>
      )}
    </section>
  );
}
