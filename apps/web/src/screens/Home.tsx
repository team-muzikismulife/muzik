import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRight } from "lucide-react";
import { useSession } from "../session";
import { useToday } from "../hooks";
import { loadTeamSummaries, supabase } from "../backend";
import { readLocal } from "../local";
import { State } from "../components/ui";
import s from "../App.module.css";
export function Home() {
  const { session, loading } = useSession();
  const today = useToday();
  const teams = useQuery({
    queryKey: ["teams", session?.user.id, today],
    queryFn: () => loadTeamSummaries(session!.user.id, today),
    enabled: Boolean(session),
  });
  const recent = readLocal<Record<string, number>>(
    `muzik:${session?.user.id}:recent`,
    {},
  );
  if (loading) return <State page />;
  if (!session)
    return (
      <section className={s.stack}>
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
              팀에 참여하기
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
      </section>
    );
  return (
    <section className={s.stack}>
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
          {[...teams.data]
            .sort((a, b) => (recent[b.id] || 0) - (recent[a.id] || 0))
            .map((team) => (
              <Link className={s.team} to={`/room/${team.id}`} key={team.id}>
                <div>
                  <h3>{team.name}</h3>
                  <small>
                    함께하는 팀원 {team.member_count}명 · {team.todayStatus}
                  </small>
                </div>
                <ArrowRight size={20} />
              </Link>
            ))}
        </div>
      ) : (
        <State title="첫 음악 모임을 시작해 볼까요?">
          <Link to="/room/join" className={s.primary}>
            팀에 참여하기
          </Link>
          <Link to="/room/create" className={s.secondary}>
            팀 만들기
          </Link>
        </State>
      )}
      {Boolean(teams.data?.length) && (
        <Link className={s.secondary} to="/room/join">
          초대 코드로 참여
        </Link>
      )}
    </section>
  );
}
