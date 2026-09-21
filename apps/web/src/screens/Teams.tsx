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
import { Protected } from "./Auth";
import { readLocal, writeLocal } from "../local";
export function Invite() {
  const { code } = useParams();
  if (!code || !INVITE_CODE.test(code.toUpperCase()))
    return (
      <State page title="초대 코드를 확인해 주세요">
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
  if (query.isPending) return <State page title="초대 확인 중" />;
  if (query.isError)
    return (
      <State page title="초대를 확인하지 못했어요">
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
      <State page title="팀 정원이 모두 찼어요">
        <p>{query.data.name}</p>
        <Link className={s.secondary} to="/">
          돌아가기
        </Link>
      </State>
    );
  return <TeamForm invite={code} teamName={query.data.name} />;
}
export function TeamForm({
  create = false,
  invite,
  teamName,
}: {
  create?: boolean;
  invite?: string;
  teamName?: string;
}) {
  const [params] = useSearchParams();
  const { session } = useSession();
  const formKey = `muzik:${session!.user.id}:team-form:${create ? "create" : (invite ?? "join")}`;
  const saved = readLocal<{ name?: string; nickname?: string }>(formKey, {});
  const [name, setName] = useState(
    typeof saved.name === "string" ? saved.name.slice(0, 20) : "",
  );
  const [code, setCode] = useState(invite ?? params.get("code") ?? "");
  const [nickname, setNickname] = useState(
    typeof saved.nickname === "string" ? saved.nickname.slice(0, 8) : "",
  );
  useEffect(() => {
    try {
      writeLocal(formKey, { name, nickname });
    } catch {
      /* Form remains available in memory. */
    }
  }, [formKey, name, nickname]);
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
      localStorage.removeItem(formKey);
      navigate(`/room/${result.roomId}${create ? "/members" : ""}`, {
        replace: true,
      });
    } catch {
      /* 입력 유지 */
    }
  };
  if (!create && !invite)
    return (
      <section className={s.stack}>
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
      </section>
    );
  return (
    <section className={s.stack}>
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
    </section>
  );
}
