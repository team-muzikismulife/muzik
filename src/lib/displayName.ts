import type { Member } from '@/types/models';

/**
 * 표시용 닉네임 해석 — **읽을 때 `members`가 정본**이다.
 *
 * `Track.nickname`·`SharedPlaylistItem.recommendedByNickname`은 쓰기 시점 스냅샷이라
 * 닉네임을 바꾸면 과거 문서가 옛 이름에 묶인다. 닉네임 변경은 `joinRoom`의 멱등 재입장이
 * **명시적으로 허용**하는 동선이라(백엔드설계.md §3) 실제로 밟기 쉽다.
 *
 * 과거 문서를 일괄 갱신하지 않는 이유: 쓰기가 곡 수만큼 늘고, 클라 직접 쓰기(Spark)에서는
 * 남의 트랙 문서를 고쳐야 해 Rules를 풀어야 한다. 화면에서 해석하는 편이 싸고 안전하다.
 *
 * 스냅샷을 지우지 않고 폴백으로 남기는 이유: **팀을 떠난 사람의 곡은 members에 없다.**
 * 그때 이름이 사라지면 "누가 올린 곡인지" 자체가 증발한다.
 */
export type NicknameResolver = (uid: string, snapshot: string) => string;

export function nicknameResolver(members: Pick<Member, 'uid' | 'nickname'>[]): NicknameResolver {
  const byUid = new Map(members.map((m) => [m.uid, m.nickname]));
  return (uid, snapshot) => byUid.get(uid) ?? snapshot;
}
