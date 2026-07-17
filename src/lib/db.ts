import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Day, Member, Room, Track } from '@/types/models';

/**
 * 실시간 구독 (docs/frontend.md § Data Fetching)
 * onSnapshot은 **반드시 (next, error) 2-arg** — 조용히 죽는 구독을 만들지 않는다.
 */

/** 방 문서 (팀 이름·인원수) 구독 */
export function subscribeRoom(
  roomId: string,
  next: (room: Room | null) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => next(snap.exists() ? (snap.data() as Room) : null),
    error,
  );
}

/** 멤버 전체 구독 (팀원 목록) */
export function subscribeMembers(
  roomId: string,
  next: (members: Member[]) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'rooms', roomId, 'members'), orderBy('joinedAt', 'asc')),
    (snap) => next(snap.docs.map((d) => d.data() as Member)),
    error,
  );
}

/** 특정 날짜의 트랙 구독 (order = 등록 순) */
export function subscribeTracks(
  roomId: string,
  dateKey: string,
  next: (tracks: Track[]) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'rooms', roomId, 'tracks'),
      where('dateKey', '==', dateKey),
      orderBy('order', 'asc'),
    ),
    (snap) => next(snap.docs.map((d) => d.data() as Track)),
    error,
  );
}

/**
 * 곡이 있는 날짜 목록 구독 — `days` 컬렉션 (날짜 탭용).
 * Firestore가 distinct를 못 하므로 등록 시 집계해 둔 days 문서로 "곡이 있는 날짜"를 얻는다.
 * 최근 14일치만 — 문서 ID(=dateKey) 내림차순.
 */
export function subscribeDays(
  roomId: string,
  next: (days: Day[]) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'rooms', roomId, 'days'), orderBy('dateKey', 'desc'), limit(14)),
    (snap) => next(snap.docs.map((d) => d.data() as Day)),
    error,
  );
}

/**
 * 킬스위치 구독 — `config/app.handoffMode` (유튜브연동설계 §3-3).
 * 유튜브가 watch_videos를 막으면 **배포 없이** 이 문서만 바꿔 첫 곡 재생으로 전환한다.
 * 문서·권한이 없으면 안전 기본값('watch_videos', 전체 핸드오프)으로 폴백한다.
 */
export function subscribeConfig(
  next: (mode: 'watch_videos' | 'first_video') => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'config', 'app'),
    (snap) => {
      const mode = snap.exists() ? (snap.data() as { handoffMode?: string }).handoffMode : undefined;
      next(mode === 'first_video' ? 'first_video' : 'watch_videos');
    },
    error,
  );
}

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

  const teams = await Promise.all(roomIds.map(fetchTeam));
  return teams.filter((t): t is TeamSummary => t !== null);
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
