import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy } from "lucide-react";
import { INVITE_CODE, safeReturnPath } from "../../../../packages/domain/index";
import { command, supabase } from "../backend";
import { useSession } from "../session";
import { useCommand } from "../hooks";
import { State, ErrorText } from "../components/ui";
import s from "../App.module.css";
export function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <State page />;
  if (!session)
    return <Login next={safeReturnPath(location.pathname + location.search)} />;
  return children;
}
export function Login({ next }: { next?: string }) {
  const [params] = useSearchParams();
  const destination = safeReturnPath(next ?? params.get("next"));
  const { session } = useSession();
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const embedded = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(/i.test(
    navigator.userAgent,
  );
  if (session && params.get("reauth") !== "1")
    return <Navigate to={destination} replace />;
  const login = async () => {
    setError(null);
    setPending(true);
    try {
      sessionStorage.setItem("muzik:oauth:return", destination);
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError(new Error("로그인을 시작하지 못했어요. 다시 시도해 주세요."));
      setPending(false);
    }
  };
  return (
    <section className={s.stack}>
      <h1>함께 들을 준비가 됐나요?</h1>
      <p className={s.muted}>Google 계정으로 내 팀과 음악 기록을 이어가요.</p>
      {!supabase ? (
        <State title="서비스 연결 준비 중">
          <p className={s.muted}>로그인과 저장은 아직 사용할 수 없어요.</p>
          <Link to="/" className={s.secondary}>
            돌아가기
          </Link>
        </State>
      ) : embedded ? (
        <State title="외부 브라우저에서 열어 주세요">
          <p className={s.muted}>
            이 브라우저에서는 Google 로그인이 제한될 수 있어요.
          </p>
          <button
            className={s.secondary}
            onClick={() =>
              void navigator.clipboard
                .writeText(location.href)
                .catch(() => setError(new Error("주소를 복사하지 못했어요.")))
            }
          >
            <Copy size={18} />
            링크 복사
          </button>
        </State>
      ) : (
        <button
          className={s.primary}
          disabled={pending}
          onClick={() => void login()}
        >
          {pending ? "로그인으로 이동 중" : "Google로 계속하기"}
        </button>
      )}
      <ErrorText error={error} />
    </section>
  );
}
let exchange: { code: string; promise: Promise<void> } | undefined;
export function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!supabase) {
      setError(new Error("서비스 연결 준비 중이에요."));
      return;
    }
    const code = new URLSearchParams(location.search).get("code");
    if (!code) {
      setError(new Error("로그인 응답을 확인하지 못했어요."));
      return;
    }
    if (exchange?.code !== code)
      exchange = {
        code,
        promise: (async () => {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error)
            throw new Error("로그인이 완료되지 않았어요. 다시 시도해 주세요.");
        })(),
      };
    let active = true;
    void exchange.promise
      .then(() => {
        if (!active) return;
        const next = safeReturnPath(
          sessionStorage.getItem("muzik:oauth:return"),
        );
        sessionStorage.removeItem("muzik:oauth:return");
        navigate(next, { replace: true });
      })
      .catch((error) => {
        if (active) setError(error);
      });
    return () => {
      active = false;
    };
  }, [navigate]);
  return error ? (
    <State page title="로그인을 완료하지 못했어요">
      <ErrorText error={error} />
      <Link
        to="/login"
        className={s.secondary}
        onClick={() => {
          exchange = undefined;
        }}
      >
        다시 로그인
      </Link>
    </State>
  ) : (
    <State page title="로그인 확인 중" />
  );
}
