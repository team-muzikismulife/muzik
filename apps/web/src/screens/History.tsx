import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { todayKey } from "../../../../packages/domain/index";
import { loadDays } from "../backend";
import { useSession } from "../session";
import { ErrorText, State } from "../components/ui";
import { useScrollMemory } from "../viewState";
import s from "../App.module.css";
export default function History({
  roomId,
  name,
}: {
  roomId: string;
  name: string;
}) {
  const { session } = useSession();
  const query = useInfiniteQuery({
    queryKey: ["history", session!.user.id, roomId],
    initialPageParam: todayKey(),
    queryFn: ({ pageParam }) => loadDays(roomId, pageParam),
    getNextPageParam: (last) =>
      last.length === 14 ? last.at(-1)!.date_key : undefined,
  });
  useScrollMemory(session!.user.id, !query.isPending);
  return (
    <section className={s.stack}>
      <Link className={s.textAction} to={`/room/${roomId}`}>
        <ArrowLeft size={18} />
        {name}
      </Link>
      <h1>지난 기록</h1>
      {query.isPending ? (
        <State />
      ) : query.isError && !query.data ? (
        <State title="기록을 불러오지 못했어요">
          <ErrorText error={query.error} />
          <button className={s.secondary} onClick={() => void query.refetch()}>
            다시 시도
          </button>
        </State>
      ) : (
        <>
          {query.data?.pages.flat().length ? (
            query.data.pages.flat().map((day) => (
              <Link
                className={s.historyRow}
                key={day.date_key}
                to={`/room/${roomId}?date=${day.date_key}`}
                state={{ fromHistory: true }}
              >
                {day.cover_video_id && (
                  <img
                    src={`https://i.ytimg.com/vi/${day.cover_video_id}/default.jpg`}
                    alt=""
                    loading="lazy"
                  />
                )}
                <div>
                  <h2>{day.date_key}</h2>
                  <p>{day.theme_text}</p>
                  <small>{day.track_count}곡</small>
                </div>
              </Link>
            ))
          ) : (
            <State title="지난 기록이 아직 없어요" />
          )}
          {query.hasNextPage && (
            <button
              className={s.secondary}
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              <ChevronDown size={18} />
              {query.isFetchingNextPage ? "불러오는 중" : "이전 기록 더 보기"}
            </button>
          )}
          {query.isFetchNextPageError && (
            <p role="alert">이전 기록을 불러오지 못했어요. 다시 눌러 주세요.</p>
          )}
        </>
      )}
    </section>
  );
}
