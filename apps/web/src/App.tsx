import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import { AudioLines, LogOut } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useSession } from "./session";
import { Boundary, State, Invalid, ErrorText } from "./components/ui";
import { Home } from "./screens/Home";
import { Login, Callback, Protected } from "./screens/Auth";
import { Invite, TeamForm } from "./screens/Teams";
import s from "./App.module.css";
const RoomRoute = lazy(() => import("./screens/Room"));
function AppUpdate() {
  const {
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [defer, setDefer] = useState(false);
  if (!refresh || defer) return null;
  return (
    <aside className={s.update}>
      <p>새 버전이 준비됐어요.</p>
      <button className={s.secondary} onClick={() => setDefer(true)}>
        나중에
      </button>
      <button
        className={s.primary}
        onClick={() => {
          if (
            window.confirm(
              "작성 중인 내용이 있다면 먼저 저장해 주세요. 업데이트할까요?",
            )
          )
            void updateServiceWorker(true);
        }}
      >
        업데이트
      </button>
    </aside>
  );
}
function Header() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);
  return (
    <>
      <header className={s.header}>
        <Link to="/" className={s.brand} aria-label="MUZIK 홈">
          <AudioLines size={25} />
          MUZIK
        </Link>
        {session && (
          <button
            className={s.icon}
            aria-label="로그아웃"
            title="로그아웃"
            onClick={() =>
              void signOut()
                .then(() => navigate("/"))
                .catch(setError)
            }
          >
            <LogOut size={20} />
          </button>
        )}
      </header>
      <ErrorText error={error} />
    </>
  );
}

export function App() {
  const location = useLocation();
  useEffect(() => {
    document.getElementById("content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <div className={s.shell}>
      <Header />
      <main id="content" tabIndex={-1}>
        <Boundary key={location.pathname}>
          <Suspense fallback={<State />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<Callback />} />
              <Route
                path="/room/create"
                element={
                  <Protected>
                    <TeamForm create />
                  </Protected>
                }
              />
              <Route
                path="/room/join"
                element={
                  <Protected>
                    <TeamForm />
                  </Protected>
                }
              />
              <Route path="/r/:code" element={<Invite />} />
              <Route path="/room/:id" element={<RoomRoute />} />
              <Route
                path="/room/:id/playlist/:dateKey"
                element={<RoomRoute playlist />}
              />
              <Route
                path="/room/:id/track/:mode"
                element={<RoomRoute editor />}
              />
              <Route path="/room/:id/members" element={<RoomRoute members />} />
              <Route path="/room/:id/history" element={<RoomRoute history />} />
              <Route path="*" element={<Invalid />} />
            </Routes>
          </Suspense>
        </Boundary>
      </main>
      <AppUpdate />
    </div>
  );
}
