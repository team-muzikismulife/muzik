import {
  Component,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  ArrowLeft,
  ArrowRight,
  Plus,
  LogOut,
  Users,
  Copy,
  Play,
  Pencil,
  Trash2,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  extractVideoId,
  INVITE_CODE,
  safeReturnPath,
  themeFor,
  todayKey,
  UUID,
  validDate,
} from "../../../packages/domain/index";
import {
  command,
  loadTeams,
  supabase,
  type Track,
  type Video,
} from "./backend";
import { useSession } from "./session";
import { useCommand, useRoom, useToday } from "./hooks";
import s from "./App.module.css";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className={s.state}>
        <h1>화면을 불러오지 못했어요</h1>
        <a href="/" className={s.secondary}>
          처음으로
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function State({
  children,
  title = "잠시만 기다려 주세요",
}: {
  children?: ReactNode;
  title?: string;
}) {
  return (
    <section className={s.state} aria-live="polite">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Invalid() {
  return (
    <State title="링크를 확인해 주세요">
      <p className={s.muted}>팀 또는 날짜 정보가 올바르지 않아요.</p>
      <Link className={s.secondary} to="/">
        팀 목록으로
      </Link>
    </State>
  );
}
function ErrorText({ error }: { error: Error | null }) {
  return error ? (
    <p role="alert" className={s.error}>
      {error.message}
    </p>
  ) : null;
}
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
  return (
    <div className={s.shell}>
      <Header />
      <Boundary key={location.pathname}>
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
          <Route path="/room/:id/track/:mode" element={<RoomRoute editor />} />
          <Route path="/room/:id/members" element={<RoomRoute members />} />
          <Route path="*" element={<Invalid />} />
        </Routes>
      </Boundary>
      <AppUpdate />
    </div>
  );
}
function Home() {
  const { session, loading } = useSession();
  const teams = useQuery({
    queryKey: ["teams", session?.user.id],
    queryFn: loadTeams,
    enabled: Boolean(session),
  });
  if (loading) return <State />;
  if (!session)
    return (
      <main className={s.stack}>
        <section className={s.intro}>
          <h1>MUZIK</h1>
          <p>
            하루 한 곡,
            <br />
            우리 팀의 음악 기록.
          </p>
          <div className={s.artwork}>
            <img
              src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
              alt="Rick Astley - Never Gonna Give You Up"
            />
            <img
              src="https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
              alt="Luis Fonsi - Despacito"
            />
          </div>
          <div className={s.actions}>
            <Link className={s.primary} to="/room/join">
              초대 코드 참여
            </Link>
            <Link className={s.secondary} to="/room/create">
              <Plus size={18} />팀 만들기
            </Link>
          </div>
        </section>
        {!supabase && (
          <section className={s.section}>
            <h2>서비스 연결 준비 중</h2>
            <p className={s.notice}>
              아직 계정 연결과 곡 저장을 제공하지 않아요. 연결이 완료되면 Google
              계정으로 참여할 수 있어요.
            </p>
          </section>
        )}
        <section className={s.section}>
          <h2>우리의 취향이 쌓이는 곳</h2>
          <p className={s.notice}>음악 한 곡과 추천하는 이유를 나눠요.</p>
        </section>
      </main>
    );
  return (
    <main className={s.stack}>
      <div className={s.between}>
        <h1>내 팀</h1>
        <Link
          to="/room/create"
          className={s.icon}
          title="팀 만들기"
          aria-label="팀 만들기"
        >
          <Plus />
        </Link>
      </div>
      {teams.isPending ? (
        <State />
      ) : teams.isError ? (
        <State title="팀 목록을 불러오지 못했어요">
          <button className={s.secondary} onClick={() => void teams.refetch()}>
            다시 시도
          </button>
        </State>
      ) : teams.data.length ? (
        <div>
          {teams.data.map((team) => (
            <Link className={s.team} to={`/room/${team.id}`} key={team.id}>
              <div>
                <h3>{team.name}</h3>
                <small>팀원 {team.member_count}명</small>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
        </div>
      ) : (
        <State title="첫 음악 모임을 시작해 볼까요?">
          <Link to="/room/create" className={s.primary}>
            팀 만들기
          </Link>
        </State>
      )}
      <Link className={s.secondary} to="/room/join">
        초대 코드로 참여
      </Link>
    </main>
  );
}
function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <State />;
  if (!session)
    return <Login next={safeReturnPath(location.pathname + location.search)} />;
  return children;
}
function Login({ next }: { next?: string }) {
  const [params] = useSearchParams();
  const destination = safeReturnPath(next ?? params.get("next"));
  const { session } = useSession();
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const embedded = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(/i.test(
    navigator.userAgent,
  );
  if (session) return <Navigate to={destination} replace />;
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
    <main className={s.stack}>
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
    </main>
  );
}
let exchange: { code: string; promise: Promise<void> } | undefined;
function Callback() {
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
      exchange = { code, promise: (async () => {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error)
          throw new Error("로그인이 완료되지 않았어요. 다시 시도해 주세요.");
      })() };
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
      .catch((error) => { if (active) setError(error); });
    return () => { active = false; };
  }, [navigate]);
  return error ? (
    <State title="로그인을 완료하지 못했어요">
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
    <State title="로그인 확인 중" />
  );
}
function Invite() {
  const { code } = useParams();
  if (!code || !INVITE_CODE.test(code.toUpperCase()))
    return (
      <State title="초대 코드를 확인해 주세요">
        <Link
          className={s.secondary}
          to={`/room/join?code=${encodeURIComponent(code ?? "")}`}
        >
          코드 다시 입력
        </Link>
      </State>
    );
  return (
    <Protected>
      <InvitePreview code={code.toUpperCase()} />
    </Protected>
  );
}
function InvitePreview({ code }: { code: string }) {
  const { session } = useSession();
  const query = useQuery({
    queryKey: ["invite", session!.user.id, code],
    queryFn: () =>
      command<{
        name: string;
        isMember: boolean;
        isFull: boolean;
        roomId: string | null;
      }>("getInvitePreview", { code }, crypto.randomUUID()),
    retry: false,
    staleTime: 0,
  });
  if (query.isPending) return <State title="초대 확인 중" />;
  if (query.isError)
    return (
      <State title="초대를 확인하지 못했어요">
        <ErrorText error={query.error} />
        <button className={s.secondary} onClick={() => void query.refetch()}>
          다시 시도
        </button>
        <Link className={s.secondary} to={`/room/join?code=${code}`}>
          코드 다시 입력
        </Link>
      </State>
    );
  if (query.data.isMember && query.data.roomId)
    return <Navigate replace to={`/room/${query.data.roomId}`} />;
  if (query.data.isFull)
    return (
      <State title="팀 정원이 모두 찼어요">
        <p>{query.data.name}</p>
        <Link className={s.secondary} to="/">
          돌아가기
        </Link>
      </State>
    );
  return <TeamForm invite={code} teamName={query.data.name} />;
}
function TeamForm({
  create = false,
  invite,
  teamName,
}: {
  create?: boolean;
  invite?: string;
  teamName?: string;
}) {
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [code, setCode] = useState(invite ?? params.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const mutation = useCommand(create ? "createRoom" : "joinRoom");
  const navigate = useNavigate();
  const cache = useQueryClient();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await mutation.mutateAsync(
        create
          ? { name: name.trim(), nickname: nickname.trim() }
          : { code: code.trim().toUpperCase(), nickname: nickname.trim() },
      );
      await cache.invalidateQueries({ queryKey: ["teams"] });
      navigate(`/room/${result.roomId}${create ? "/members" : ""}`, {
        replace: true,
      });
    } catch {
      /* 입력 유지 */
    }
  };
  if (!create && !invite)
    return (
      <main className={s.stack}>
        <h1>팀에 참여하기</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/r/${code.toUpperCase()}`);
          }}
        >
          <label>
            초대 코드
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              required
            />
          </label>
          <button className={s.primary} disabled={!INVITE_CODE.test(code)}>
            초대 확인
          </button>
        </form>
      </main>
    );
  return (
    <main className={s.stack}>
      <Link to="/" className={s.row}>
        <ArrowLeft size={18} />내 팀
      </Link>
      <h1>{create ? "팀 만들기" : teamName}</h1>
      <form onSubmit={submit}>
        {create ? (
          <label>
            팀 이름
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              required
              autoComplete="off"
            />
          </label>
        ) : (
          <p className={s.muted}>초대 코드 {code}</p>
        )}
        <label>
          이 팀에서 쓸 닉네임
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={8}
            required
            autoComplete="nickname"
          />
        </label>
        <ErrorText error={mutation.error} />
        <button
          className={s.primary}
          disabled={
            mutation.isPending ||
            !nickname.trim() ||
            (create ? !name.trim() : !INVITE_CODE.test(code))
          }
        >
          {mutation.isPending ? "저장 중" : create ? "팀 개설하기" : "입장하기"}
        </button>
      </form>
    </main>
  );
}
function RoomRoute(props: {
  playlist?: boolean;
  editor?: boolean;
  members?: boolean;
}) {
  const { id, dateKey, mode } = useParams();
  const [params] = useSearchParams();
  const today = useToday();
  const [openedDate] = useState(todayKey);
  const date = dateKey ?? params.get("date") ?? (props.editor ? openedDate : today);
  if (
    !id ||
    !UUID.test(id) ||
    !validDate(date) ||
    (props.editor && !["new", "edit"].includes(mode ?? ""))
  )
    return <Invalid />;
  return (
    <Protected>
      <RoomContent id={id} date={date} {...props} />
    </Protected>
  );
}
function RoomContent({
  id,
  date,
  playlist,
  editor,
  members,
}: {
  id: string;
  date: string;
  playlist?: boolean;
  editor?: boolean;
  members?: boolean;
}) {
  const { session } = useSession();
  const result = useRoom(id, date, session!.user.id);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<Error | null>(null);
  if (result.isPending) return <State />;
  if (result.isError)
    return (
      <State title="팀을 불러오지 못했어요">
        <ErrorText error={result.error} />
        <button className={s.secondary} onClick={() => void result.refetch()}>
          다시 시도
        </button>
        <Link to="/" className={s.secondary}>
          팀 목록으로
        </Link>
      </State>
    );
  const data = result.data;
  const today = todayKey();
  const mine = data.tracks.find((t) => t.user_id === session!.user.id);
  const visible = data.tracks.filter((t) => !t.hidden);
  if (editor)
    return (
      <TrackEditor key={`${id}:${date}`} id={id} track={mine} date={date} />
    );
  if (members)
    return (
      <main className={s.stack}>
        <Link to={`/room/${id}`} className={s.row}>
          <ArrowLeft size={18} />
          {data.room.name}
        </Link>
        <h1>함께 들을 사람들</h1>
        <section className={s.section}>
          <p className={s.muted}>초대 코드</p>
          <p className={s.code}>{data.room.invite_code}</p>
          <button
            className={s.secondary}
            onClick={() =>
              void navigator.clipboard
                .writeText(`${location.origin}/r/${data.room.invite_code}`)
                .then(() => setCopied(true))
                .catch(() =>
                  setCopyError(new Error("링크를 복사하지 못했어요.")),
                )
            }
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
            {copied ? "초대 링크 복사됨" : "초대 링크 복사"}
          </button>
          <ErrorText error={copyError} />
        </section>
        <p>팀원 {data.members.length}명</p>
        {data.members.map((m) => (
          <div className={s.row} key={m.user_id}>
            <span className={s.avatar}>{m.nickname.slice(0, 1)}</span>
            {m.nickname}
          </div>
        ))}
        <Link to={`/room/${id}`} className={s.primary}>
          팀으로 이동
        </Link>
      </main>
    );
  const dates = [...new Set([today, date, ...data.days.map((d) => d.date_key)])]
    .sort()
    .reverse();
  return (
    <main className={s.stack}>
      <div className={s.between}>
        <div className={s.row}>
          <Link className={s.icon} to="/" aria-label="팀 목록으로">
            <ArrowLeft />
          </Link>
          <h1>{data.room.name}</h1>
        </div>
        <Link
          className={s.icon}
          to={`/room/${id}/members`}
          aria-label="팀원과 초대 코드"
          title="팀원과 초대 코드"
        >
          <Users />
        </Link>
      </div>
      <div className={s.roomTools}>
        <nav className={s.tabs} aria-label="날짜 선택">
          {dates.map((d) => (
            <Link
              className={`${s.tab} ${d === date ? s.selected : ""}`}
              aria-current={d === date ? "date" : undefined}
              to={`/room/${id}?date=${d}`}
              key={d}
            >
              {d === today
                ? "오늘"
                : `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}
            </Link>
          ))}
        </nav>
        <p className={s.live}>
          {result.live ? "팀의 최신 음악을 받고 있어요" : "연결 확인 중"}
        </p>
        <Link
          className={s.mission}
          to={`/room/${id}/playlist/${date}`}
          aria-label="해당 날짜 플레이리스트 열기"
        >
          <div>
            <small>{date === today ? "오늘의 미션" : date}</small>
            <p>
              {data.days.find((d) => d.date_key === date)?.theme_text ??
                themeFor(date)}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
      </div>
      {playlist && (
        <div className={s.between}>
          <h2>
            {Number(date.slice(5, 7))}월 {Number(date.slice(8))}일 플레이리스트
          </h2>
          <small>{visible.length}곡</small>
        </div>
      )}
      {!visible.length ? (
        <State
          title={
            date === today ? "오늘의 첫 곡을 기다려요" : "등록된 곡이 없어요"
          }
        >
          {mine?.hidden && (
            <p className={s.notice}>내 곡은 운영자가 숨김 처리했어요.</p>
          )}
        </State>
      ) : (
        visible.map((track) => (
          <TrackCard
            key={track.user_id}
            id={id}
            track={track}
            nickname={
              data.members.find((m) => m.user_id === track.user_id)?.nickname ??
              "팀원"
            }
            mine={track.user_id === session!.user.id && date === today}
          />
        ))
      )}
      <details className={s.members}>
        <summary>
          참여 현황 {visible.length}/{data.members.length}
        </summary>
        <ul>
          {data.members.map((m) => (
            <li className={s.between} key={m.user_id}>
              <span>{m.nickname}</span>
              <small>
                {visible.some((t) => t.user_id === m.user_id)
                  ? "등록 완료"
                  : "아직 등록 전"}
              </small>
            </li>
          ))}
        </ul>
      </details>
      {date === today && !mine?.hidden && (
        <div className={s.stickyAction}>
          <Link
            className={s.primary}
            to={`/room/${id}/track/${mine ? "edit" : "new"}?date=${date}`}
          >
            {mine ? <Pencil size={18} /> : <Plus size={18} />}{" "}
            {mine ? "내 곡 수정" : "오늘의 곡 추가"}
          </Link>
        </div>
      )}
      {date !== today && (
        <Link className={s.secondary} to={`/room/${id}`}>
          오늘로 돌아가기
        </Link>
      )}
    </main>
  );
}
function TrackCard({
  id,
  track,
  nickname,
  mine,
}: {
  id: string;
  track: Track;
  nickname: string;
  mine: boolean;
}) {
  const mutation = useCommand("deleteTrack");
  const cache = useQueryClient();
  const remove = async () => {
    if (!confirm("오늘의 곡을 삭제할까요?")) return;
    try {
      await mutation.mutateAsync({ roomId: id, dateKey: track.date_key });
      await cache.invalidateQueries({ queryKey: ["room"] });
    } catch {
      /* 오류 표시 */
    }
  };
  return (
    <article className={s.track}>
      <img
        className={s.trackArt}
        src={`https://i.ytimg.com/vi/${track.video_id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
      />
      <div className={s.trackInfo}>
        <div className={s.between}>
          <div className={s.row}>
            <span className={s.avatar}>{nickname.slice(0, 1)}</span>
            <small>{nickname}</small>
          </div>
          {mine && (
            <details className={s.menu}>
              <summary aria-label="내 곡 관리" title="내 곡 관리">
                <MoreHorizontal size={20} />
              </summary>
              <div>
                <Link to={`/room/${id}/track/edit?date=${track.date_key}`}>
                  <Pencil size={16} />
                  수정
                </Link>
                <button
                  disabled={mutation.isPending}
                  onClick={() => void remove()}
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              </div>
            </details>
          )}
        </div>
        <div>
          <h3>{track.title}</h3>
          <small>{track.artist}</small>
        </div>
        <p className={s.comment}>{track.comment}</p>
        <a
          className={s.secondary}
          href={`https://www.youtube.com/watch?v=${track.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Play size={16} />
          YouTube에서 듣기
        </a>
        <ErrorText error={mutation.error} />
      </div>
    </article>
  );
}
function TrackEditor({
  id,
  track,
  date,
}: {
  id: string;
  track?: Track;
  date: string;
}) {
  const { mode } = useParams();
  const editing = mode === "edit";
  const [link, setLink] = useState(
    track ? `https://youtu.be/${track.video_id}` : "",
  );
  const [comment, setComment] = useState(track?.comment ?? "");
  const [video, setVideo] = useState<Video | null>(
    track
      ? {
          videoId: track.video_id,
          title: track.title,
          artist: track.artist,
          durationSec: 0,
          embeddable: true,
        }
      : null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const mutation = useCommand(editing ? "updateTrack" : "registerTrack");
  const navigate = useNavigate();
  const cache = useQueryClient();
  const videoId = extractVideoId(link);
  if (editing && (!track || track.hidden || date !== todayKey()))
    return (
      <State title="수정할 수 없는 곡이에요">
        <Link className={s.secondary} to={`/room/${id}`}>
          팀으로 돌아가기
        </Link>
      </State>
    );
  const preview = async () => {
    setError(null);
    setPreviewing(true);
    try {
      if (!videoId) throw new Error("YouTube 링크를 확인해 주세요.");
      setVideo(
        await command<Video>(
          "previewTrack",
          { roomId: id, videoId },
          crypto.randomUUID(),
        ),
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setPreviewing(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!video || video.videoId !== videoId) return;
    try {
      const result = await mutation.mutateAsync({
        roomId: id,
        videoId: video.videoId,
        comment,
        ...(editing ? { dateKey: date } : {}),
      });
      await cache.invalidateQueries({ queryKey: ["room"] });
      navigate(`/room/${id}?date=${result.dateKey}`, { replace: true });
    } catch {
      /* 입력 유지 */
    }
  };
  return (
    <main className={s.stack}>
      <Link className={s.row} to={`/room/${id}`}>
        <ArrowLeft size={18} />
        팀으로
      </Link>
      <h1>{editing ? "내 곡 수정" : "오늘의 한 곡"}</h1>
      <form onSubmit={submit}>
        <label>
          YouTube 링크
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setVideo(null);
            }}
            placeholder="https://youtu.be/..."
            autoComplete="off"
            inputMode="url"
          />
        </label>
        <button
          className={s.secondary}
          type="button"
          disabled={!videoId || previewing || mutation.isPending}
          onClick={() => void preview()}
        >
          {previewing ? "확인 중" : "영상 확인"}
        </button>
        {video && (
          <div className={s.preview}>
            <img
              src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
              alt=""
            />
            <div>
              <h2>{video.title}</h2>
              <p className={s.muted}>{video.artist}</p>
            </div>
          </div>
        )}
        <label>
          추천하는 이유
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={30}
            rows={3}
          />
          <small>{comment.length}/30</small>
        </label>
        <ErrorText error={error ?? mutation.error} />
        <button
          className={s.primary}
          disabled={
            !video ||
            video.videoId !== videoId ||
            mutation.isPending ||
            previewing
          }
        >
          {mutation.isPending
            ? "저장 중"
            : editing
              ? "수정 완료"
              : "곡 등록하기"}
        </button>
      </form>
    </main>
  );
}
