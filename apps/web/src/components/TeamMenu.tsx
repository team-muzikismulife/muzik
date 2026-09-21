import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Share2, Pencil, Eye, Users } from "lucide-react";
import type { Room, Member } from "../backend";
import { useCommand } from "../hooks";
import { useSession } from "../session";
import { Menu, ErrorText } from "./ui";
import s from "../App.module.css";
export function TeamMenu({
  room,
  members,
  hiddenCount,
  restoreAll,
}: {
  room: Room;
  members: Member[];
  hiddenCount: number;
  restoreAll: () => void;
}) {
  const { session } = useSession();
  const me = members.find((m) => m.user_id === session!.user.id);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(me?.nickname ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const mutation = useCommand("updateNickname");
  const cache = useQueryClient();
  const share = async () => {
    setError(null);
    try {
      const url = `${location.origin}/r/${room.invite_code}`;
      if (navigator.share) {
        await navigator.share({ title: room.name, url });
        setNotice("초대 링크를 공유했어요.");
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("초대 링크를 복사했어요.");
      }
    } catch (cause) {
      if ((cause as Error).name !== "AbortError")
        setError(
          new Error(
            "공유하지 못했어요. 브라우저의 링크 복사 권한을 확인해 주세요.",
          ),
        );
    }
  };
  return (
    <>
      <div className={s.teamMenuRow}>
        <button className={s.textAction} onClick={() => void share()}>
          <Share2 size={18} />
          초대하기
        </button>
        <Menu label="팀 관리">
          {(close) => (
            <>
              <button
                onClick={() => {
                  close();
                  setNickname(me?.nickname ?? "");
                  setEditing(true);
                }}
              >
                <Pencil size={16} />내 닉네임 변경
              </button>
              <button
                disabled={!hiddenCount}
                onClick={() => {
                  close();
                  try {
                    restoreAll();
                    setNotice("숨긴 곡을 모두 복원했어요.");
                  } catch {
                    setError(new Error("기기 설정을 저장하지 못했어요."));
                  }
                }}
              >
                <Eye size={16} />
                숨긴 곡 복원 ({hiddenCount})
              </button>
              <Link to={`/room/${room.id}/members`} onClick={close}>
                <Users size={16} />
                함께하는 팀원
              </Link>
            </>
          )}
        </Menu>
      </div>
      {notice && (
        <p role="status" className={s.notice}>
          {notice}
        </p>
      )}
      <ErrorText error={error} />
      {editing && (
        <form
          className={s.section}
          onSubmit={(e) => {
            e.preventDefault();
            void mutation
              .mutateAsync({ roomId: room.id, nickname: nickname.trim() })
              .then(async () => {
                await cache.invalidateQueries({ queryKey: ["room"] });
                setEditing(false);
                setNotice("이 팀의 닉네임을 변경했어요.");
              })
              .catch(() => {});
          }}
        >
          <label>
            이 팀에서 쓸 닉네임
            <input
              autoFocus
              value={nickname}
              maxLength={8}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          <ErrorText error={mutation.error} />
          <div className={s.actions}>
            <button
              className={s.primary}
              disabled={!nickname.trim() || mutation.isPending}
            >
              닉네임 저장
            </button>
            <button
              type="button"
              className={s.secondary}
              onClick={() => setEditing(false)}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </>
  );
}
