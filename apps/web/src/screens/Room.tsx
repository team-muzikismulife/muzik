import { lazy, Suspense, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Plus,
  Pencil,
  RotateCcw,
} from "lucide-react";
import {
  UUID,
  validDate,
  todayKey,
  themeFor,
} from "../../../../packages/domain/index";
import { listDrafts } from "../../../../packages/domain/drafts";
import { useSession } from "../session";
import { useRoom, useToday } from "../hooks";
import { touchTeam, useHidden } from "../local";
import { useScrollMemory } from "../viewState";
import { Protected } from "./Auth";
import { State, Invalid, ErrorText } from "../components/ui";
import { TrackCard } from "../components/TrackCard";
import { TeamMenu } from "../components/TeamMenu";
import s from "../App.module.css";
const TrackEditor = lazy(() => import("./TrackEditor"));
const History = lazy(() => import("./History"));
const Player = lazy(() => import("../components/Player"));
type View = {
  playlist?: boolean;
  editor?: boolean;
  members?: boolean;
  history?: boolean;
};
export default function RoomRoute(props: View) {
  const { id, dateKey, mode } = useParams();
  const [params] = useSearchParams();
  const today = useToday();
  const [openedDate] = useState(todayKey);
  const date =
    dateKey ?? params.get("date") ?? (props.editor ? openedDate : today);
  const record = params.get("track") ?? undefined;
  if (
    !id ||
    !UUID.test(id) ||
    !validDate(date) ||
    date > today ||
    params.getAll("date").length > 1 ||
    params.getAll("track").length > 1 ||
    (record && !UUID.test(record)) ||
    (props.editor && !["new", "edit"].includes(mode || ""))
  )
    return <Invalid />;
  return (
    <Protected>
      <RoomContent
        id={id}
        date={date}
        record={record}
        mode={mode === "edit" ? "edit" : "new"}
        {...props}
      />
    </Protected>
  );
}
function RoomContent({
  id,
  date,
  record,
  mode,
  ...view
}: { id: string; date: string; record?: string; mode: "new" | "edit" } & View) {
  const { session } = useSession();
  const uid = session!.user.id;
  const result = useRoom(id, date, uid);
  const hidden = useHidden(uid, id);
  useEffect(() => {
    if (result.data) touchTeam(uid, id);
  }, [uid, id, Boolean(result.data)]);
  if (result.isPending) return <State page title="팀의 음악을 불러오는 중" />;
  if (result.isError)
    return (
      <section className={s.state}>
        <h1>팀을 불러오지 못했어요</h1>
        <ErrorText error={result.error} />
        <button className={s.secondary} onClick={() => void result.refetch()}>
          다시 시도
        </button>
        <Link to="/" className={s.secondary}>
          팀 목록으로
        </Link>
      </section>
    );
  const data = result.data;
  const mine = data.tracks.find((t) => t.user_id === uid);
  if (view.editor && mode === "edit" && !record && !mine)
    return (
      <State page title="수정할 곡을 찾지 못했어요">
        <Link className={s.secondary} to={`/room/${id}?date=${date}`}>
          팀으로 돌아가기
        </Link>
      </State>
    );
  if (view.editor)
    return (
      <Suspense fallback={<State page />}>
        <TrackEditor
          key={`${uid}:${id}:${date}:${mode}:${record}`}
          roomId={id}
          date={date}
          mode={mode}
          track={mine}
          expectedId={record}
        />
      </Suspense>
    );
  if (view.history)
    return (
      <Suspense fallback={<State page />}>
        <History roomId={id} name={data.room.name} />
      </Suspense>
    );
  if (view.members)
    return (
      <section className={s.stack}>
        <Link className={s.textAction} to={`/room/${id}`}>
          <ArrowLeft size={18} />
          {data.room.name}
        </Link>
        <h1>함께하는 팀원</h1>
        <TeamMenu
          room={data.room}
          members={data.members}
          hiddenCount={hidden.ids.length}
          restoreAll={hidden.restoreAll}
        />
        <p>{data.members.length}명</p>
        {data.members.map((m) => (
          <div className={s.row} key={m.user_id}>
            <span className={s.avatar}>{m.nickname.slice(0, 1)}</span>
            {m.nickname}
          </div>
        ))}
        <Link className={s.primary} to={`/room/${id}`}>
          팀으로 이동
        </Link>
      </section>
    );
  return (
    <Feed
      key={`${id}:${date}:${Boolean(view.playlist)}`}
      roomId={id}
      date={date}
      record={record}
      playlist={view.playlist}
      data={data}
      live={result.live}
      hidden={hidden}
      uid={uid}
    />
  );
}
function Feed({
  roomId,
  date,
  record,
  playlist,
  data,
  live,
  hidden,
  uid,
}: {
  roomId: string;
  date: string;
  record?: string;
  playlist?: boolean;
  data: NonNullable<ReturnType<typeof useRoom>["data"]>;
  live: boolean;
  hidden: ReturnType<typeof useHidden>;
  uid: string;
}) {
  useScrollMemory(uid, true);
  const location = useLocation();
  const navigate = useNavigate();
  const today = useToday();
  const [undo, setUndo] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mine = data.tracks.find((t) => t.user_id === uid);
  const available = data.tracks.filter((t) => !t.hidden);
  const visible = available.filter((t) => !hidden.ids.includes(t.id));
  const drafts = listDrafts(localStorage, uid, roomId).filter(
    (d) => d.dateKey === date && (d.link || d.comment || d.intent),
  );
  const draft = drafts.find((d) => d.intent) ?? drafts[0];
  const hide = (id: string) => {
    try {
      hidden.hide(id);
      setUndo(id);
    } catch {
      setError(new Error("숨김 설정을 저장하지 못했어요."));
    }
  };
  return (
    <section className={s.stack}>
      <div className={s.row}>
        <Link className={s.icon} to="/" aria-label="팀 목록으로">
          <ArrowLeft />
        </Link>
        <h1>{data.room.name}</h1>
      </div>
      <TeamMenu
        room={data.room}
        members={data.members}
        hiddenCount={hidden.ids.length}
        restoreAll={hidden.restoreAll}
      />
      <nav className={s.tabs} aria-label="팀 기록">
        <Link
          className={`${s.tab} ${date === today ? s.selected : ""}`}
          to={`/room/${roomId}`}
          aria-current={date === today ? "page" : undefined}
        >
          오늘
        </Link>
        <Link
          className={`${s.tab} ${date !== today ? s.selected : ""}`}
          to={`/room/${roomId}/history`}
        >
          지난 기록
        </Link>
        {date !== today && <span className={s.dateLabel}>{date}</span>}
      </nav>
      {date !== today && location.state?.fromHistory && (
        <button className={s.textAction} onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          기록 목록으로 돌아가기
        </button>
      )}
      <div className={s.roomTools}>
        <Link
          className={s.mission}
          to={`/room/${roomId}/playlist/${date}`}
          aria-label="해당 날짜 플레이리스트 열기"
        >
          <div>
            <small>
              {date === today
                ? "오늘의 추천 주제 · 자유롭게 골라도 좋아요"
                : `${date}의 추천 주제`}
            </small>
            <p>
              {data.days.find((d) => d.date_key === date)?.theme_text ??
                themeFor(date)}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <p className={s.live}>
          {live ? "팀의 최신 음악을 받고 있어요" : "연결 확인 중"}
        </p>
      </div>
      {!playlist && (
        <div className={s.actions}>
          {date === today && !mine ? (
            <Link
              className={s.primary}
              to={`/room/${roomId}/track/new?date=${date}`}
            >
              <Plus size={18} />
              오늘의 곡 추가
            </Link>
          ) : (
            <Link className={s.primary} to={`/room/${roomId}/playlist/${date}`}>
              <Play size={18} />
              모아듣기
            </Link>
          )}
          {date === today && mine && !mine.hidden ? (
            <Link
              className={s.secondary}
              to={`/room/${roomId}/track/edit?date=${date}&track=${mine.id}`}
            >
              <Pencil size={18} />내 곡 수정
            </Link>
          ) : !mine && visible.length > 0 ? (
            <Link
              className={s.secondary}
              to={`/room/${roomId}/playlist/${date}`}
            >
              <Play size={18} />
              모아듣기
            </Link>
          ) : null}
        </div>
      )}
      {draft && (
        <Link
          className={s.textAction}
          to={`/room/${roomId}/track/${draft.mode}?date=${draft.dateKey}${draft.trackId ? `&track=${draft.trackId}` : ""}`}
        >
          <Pencil size={16} />
          {draft.intent ? "저장 결과 확인하기" : "작성하던 초안 이어쓰기"}
        </Link>
      )}
      {undo && hidden.ids.includes(undo) && (
        <div className={s.undo} role="status">
          <p>이 기기에서 곡을 숨겼어요.</p>
          <button
            className={s.textAction}
            onClick={() => {
              try {
                hidden.restore(undo);
                setUndo(null);
              } catch {
                setError(new Error("숨김 설정을 저장하지 못했어요."));
              }
            }}
          >
            <RotateCcw size={16} />
            되돌리기
          </button>
        </div>
      )}
      <ErrorText error={error} />
      {playlist && visible.length > 0 && (
        <Suspense fallback={<State title="플레이어 준비 중" />}>
          <Player tracks={visible} members={data.members} startId={record} />
        </Suspense>
      )}
      {visible.length ? (
        visible.map((track) => (
          <TrackCard
            key={track.id}
            roomId={roomId}
            track={track}
            nickname={
              data.members.find((m) => m.user_id === track.user_id)?.nickname ??
              "팀원"
            }
            mine={track.user_id === uid}
            editable={date === today}
            onHide={hide}
          />
        ))
      ) : (
        <State
          title={
            available.length
              ? "모든 곡을 숨겼어요"
              : date === today
                ? "오늘의 첫 곡을 기다려요"
                : "등록된 곡이 없어요"
          }
        >
          {available.length > 0 && (
            <button className={s.secondary} onClick={hidden.restoreAll}>
              숨긴 곡 모두 복원
            </button>
          )}
          {mine?.hidden && <p>내 곡은 운영자가 숨김 처리했어요.</p>}
        </State>
      )}
      <details className={s.members}>
        <summary>
          함께하는 팀원 {data.members.length}명 · 등록 {available.length}곡
        </summary>
        <ul>
          {data.members.map((m) => (
            <li className={s.between} key={m.user_id}>
              <span>{m.nickname}</span>
              <small>
                {available.some((t) => t.user_id === m.user_id)
                  ? "등록 완료"
                  : "아직 등록 전"}
              </small>
            </li>
          ))}
        </ul>
      </details>
      {date !== today && (
        <Link className={s.secondary} to={`/room/${roomId}`}>
          오늘로 돌아가기
        </Link>
      )}
    </section>
  );
}
