import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router";
import { AudioLines, LogOut } from "lucide-react";
import { PwaProvider, AppUpdate } from "./components/Pwa";
import { useCapabilities } from "./operations";
import { useSession } from "./session";
import { Boundary, State, Invalid, ErrorText } from "./components/ui";
import { Home } from "./screens/Home";
import { Login, Callback, Protected } from "./screens/Auth";
import { Invite, TeamForm } from "./screens/Teams";
import s from "./App.module.css";
const RoomRoute = lazy(() => import("./screens/Room"));
const Operations = lazy(() => import("./screens/Operations"));
function Header() {
  const capabilities = useCapabilities();
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
      {capabilities.data?.operator && (
        <Link className={s.textAction} to="/operations">
          운영 검토
        </Link>
      )}
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
    <PwaProvider>
      <div
        className={s.shell}
        data-app-version={import.meta.env.VITE_APP_VERSION || "local"}
      >
        <Header />
        <main id="content" tabIndex={-1}>
          <Boundary key={location.pathname}>
            <Suspense fallback={<State page />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<Callback />} />
                <Route
                  path="/operations"
                  element={
                    <Protected>
                      <Operations />
                    </Protected>
                  }
                />
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
                <Route
                  path="/room/:id/members"
                  element={<RoomRoute members />}
                />
                <Route
                  path="/room/:id/history"
                  element={<RoomRoute history />}
                />
                <Route
                  path="/room/:id/feedback"
                  element={<RoomRoute feedback />}
                />
                <Route path="*" element={<Invalid />} />
              </Routes>
            </Suspense>
          </Boundary>
        </main>
        <AppUpdate />
      </div>
    </PwaProvider>
  );
}
