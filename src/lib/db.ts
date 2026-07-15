import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Member, Room } from '@/types/models';

/**
 * 읽기 레이어 (docs/frontend.md § Data Fetching)
 * 화면·컴포넌트에서 Firestore를 직접 부르지 않는다. 읽기는 여기, 쓰기는 api.ts.
 */

/** 팀 카드에 필요한 만큼만 — 멤버 전체를 읽지 않는다 */
export interface TeamSummary {
  id: string;
  name: string;
  /** rooms.memberCount — 아바타는 4개만 읽으므로 인원수는 이 필드가 진실이다 */
  memberCount: number;
  /** 아바타 스택용 (최대 4명) */
  members: Pick<Member, 'uid' | 'nickname' | 'photoColor'>[];
}

/** Figma: 아바타 스택은 최대 4개 (107:1126) */
const AVATAR_LIMIT = 4;

/**
 * 참여 중인 팀 목록 (온보딩구현계획.md §3)
 *
 * members는 서브컬렉션이라 "uid가 나인 방"을 문서 ID로는 찾을 수 없다.
 * → members에 실어둔 `uid` 필드로 collectionGroup 조회한다.
 *
 * **`where('uid','==',uid)`는 지우면 안 된다.** Security Rules가 `resource.data.uid`를 보므로,
 * 이 제약이 빠지면 룰이 통과시키지 않는다(permission-denied).
 */
export async function fetchMyTeams(uid: string): Promise<TeamSummary[]> {
  const myMemberships = await getDocs(
    query(collectionGroup(db, 'members'), where('uid', '==', uid)),
  );

  const roomIds = myMemberships.docs
    .map((d) => d.ref.parent.parent?.id)
    .filter((id): id is string => !!id);

  // allSettled로 격리한다 — 방 하나 조회가 실패해도 나머지 팀은 보여준다.
  // 온보딩은 포커스마다 재조회되는 핵심 경로라, 부분 실패에 화면 전체가 무너지면 안 된다.
  const results = await Promise.allSettled(roomIds.map(fetchTeam));
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<TeamSummary | null> => r.status === 'fulfilled',
  );

  // 단, **전부 실패**했으면 빈 목록으로 숨기지 않는다 — 네트워크 장애를 "팀 없음"으로
  // 표시하면 사용자가 있던 팀을 다시 만들려 든다. 그때는 에러를 던져 재시도를 유도한다.
  // (fetchTeam이 null을 준 건 '방이 삭제됨'이라 정상 제외다 — 실패가 아니다)
  if (fulfilled.length === 0 && results.length > 0) {
    throw (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
  }

  return fulfilled.map((r) => r.value).filter((t): t is TeamSummary => t !== null);
}

/** 방 하나 + 아바타용 멤버 4명. 방이 사라졌으면 null (멤버 문서만 남은 경우) */
async function fetchTeam(roomId: string): Promise<TeamSummary | null> {
  const [roomSnap, memberSnap] = await Promise.all([
    getDoc(doc(db, 'rooms', roomId)),
    getDocs(query(collection(db, 'rooms', roomId, 'members'), limit(AVATAR_LIMIT))),
  ]);

  if (!roomSnap.exists()) return null;
  const room = roomSnap.data() as Room;

  return {
    id: roomId,
    name: room.name,
    memberCount: room.memberCount,
    members: memberSnap.docs.map((d) => {
      const m = d.data() as Member;
      return { uid: m.uid, nickname: m.nickname, photoColor: m.photoColor };
    }),
  };
}
