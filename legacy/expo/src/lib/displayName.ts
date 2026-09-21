import type { Member } from '@/types/models';

// 현재 멤버 이름을 우선하고, 탈퇴한 멤버는 등록 당시 스냅샷으로 표시한다.
export function nicknameResolver(members: Pick<Member, 'uid' | 'nickname'>[]) {
  const byUid = new Map(members.map(member => [member.uid, member.nickname]));
  return (uid: string, snapshot: string): string => byUid.get(uid) ?? snapshot;
}
