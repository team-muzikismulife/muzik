import { Link } from "react-router";
import {
  validDraft,
  draftKey,
  type Draft,
} from "../../../../packages/domain/drafts";
import s from "../App.module.css";
export function userDrafts(uid: string): Draft[] {
  const drafts: Draft[] = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(`muzik:${uid}:draft:`)) continue;
      try {
        const d = JSON.parse(localStorage.getItem(key) || "null");
        if (validDraft(d) && d.uid === uid && draftKey(d) === key)
          drafts.push(d);
      } catch {}
    }
  } catch {}
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}
export function LocalDrafts({ uid }: { uid: string }) {
  const drafts = userDrafts(uid);
  if (!drafts.length) return null;
  return (
    <section className={s.section}>
      <h2>이 기기에 보관한 내 초안</h2>
      <p className={s.notice}>
        팀 자료가 아닌 작성 중인 내용이에요. 저장하려면 온라인에서 같은 계정으로
        확인해 주세요.
      </p>
      {drafts.map((d) => (
        <Link
          className={s.textAction}
          key={draftKey(d)}
          to={`/room/${d.roomId}/track/${d.mode}?date=${d.dateKey}${d.trackId ? `&track=${d.trackId}` : ""}`}
        >
          {d.dateKey} · {d.mode === "edit" ? "수정 초안" : "새 곡 초안"}
          {d.intent ? " · 저장 확인 필요" : ""}
        </Link>
      ))}
    </section>
  );
}
