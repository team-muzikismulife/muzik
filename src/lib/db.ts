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
const SHARED_PLAYLIST_LIMIT = 50;

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

  // 실제 팀만 추린다. fetchTeam이 준 null은 '방이 삭제됨'이라 정상 제외다(실패가 아니다).
  const teams = results
    .filter((r): r is PromiseFulfilledResult<TeamSummary | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((t): t is TeamSummary => t !== null);

  // 실제 팀이 하나도 없는데 **거부된 조회가 있으면** 빈 목록으로 숨기지 않는다 —
  // 네트워크 장애를 "팀 없음"으로 표시하면 사용자가 있던 팀을 다시 만들려 든다.
  // (삭제된 방 null과 조회 실패가 섞인 경우도 여기서 걸린다: 실제 팀 0 + 실패 존재 → throw)
  const rejected = results.find((r) => r.status === 'rejected');
  if (teams.length === 0 && rejected) {
    throw (rejected as PromiseRejectedResult).reason;
  }

  return teams;
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

export interface RoomWithId extends Room {
  id: string;
}

export interface RoomHomeSubscription {
  onRoom: (room: RoomWithId | null) => void;
  onMembers: (members: Member[]) => void;
  onTracks: (tracks: Track[]) => void;
  onDay: (day: Day | null) => void;
  onError: (error: unknown) => void;
}

/**
 * 방 홈 실시간 구독 (백엔드설계.md §5)
 *
 * 화면은 구독을 직접 만들지 않는다. 여기서 Firestore 경로와 정렬 규칙을 캡슐화하고,
 * Zustand store가 스냅샷을 받아 화면 상태로 변환한다.
 */
export function subscribeRoomHome(
  roomId: string,
  dateKey: string,
  handlers: RoomHomeSubscription,
): Unsubscribe {
  const roomRef = doc(db, 'rooms', roomId);

  const unsubscribers = [
    onSnapshot(
      roomRef,
      (snap) => {
        handlers.onRoom(
          snap.exists() ? ({ ...(snap.data() as Omit<Room, 'id'>), id: snap.id }) : null,
        );
      },
      handlers.onError,
    ),
    onSnapshot(
      query(collection(db, 'rooms', roomId, 'members'), orderBy('joinedAt', 'asc')),
      (snap) => handlers.onMembers(snap.docs.map((d) => d.data() as Member)),
      handlers.onError,
    ),
    onSnapshot(
      tracksByDateQuery(roomId, dateKey),
      (snap) => handlers.onTracks(snap.docs.map((d) => d.data() as Track)),
      handlers.onError,
    ),
    onSnapshot(
      doc(db, 'rooms', roomId, 'days', dateKey),
      (snap) => handlers.onDay(snap.exists() ? (snap.data() as Day) : null),
      handlers.onError,
    ),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export interface PlaylistDetailData {
  tracks: Track[];
  day: Day | null;
}

export interface PlaylistDetailSubscription {
  onTracks: (tracks: Track[]) => void;
  onDay: (day: Day | null) => void;
  onError: (error: unknown) => void;
}

function tracksByDateQuery(roomId: string, dateKey: string) {
  return query(
    collection(db, 'rooms', roomId, 'tracks'),
    where('dateKey', '==', dateKey),
    orderBy('order', 'asc'),
  );
}

/** 날짜별 플레이리스트 1회 조회 — 과거 날짜 상세에서 사용한다. */
export async function fetchPlaylistDetail(
  roomId: string,
  dateKey: string,
): Promise<PlaylistDetailData> {
  const [tracksSnap, daySnap] = await Promise.all([
    getDocs(tracksByDateQuery(roomId, dateKey)),
    getDoc(doc(db, 'rooms', roomId, 'days', dateKey)),
  ]);

  return {
    tracks: tracksSnap.docs.map((d) => d.data() as Track),
    day: daySnap.exists() ? (daySnap.data() as Day) : null,
  };
}

/** 날짜별 플레이리스트 실시간 구독 — 오늘 날짜 상세에서 사용한다. */
export function subscribePlaylistDetail(
  roomId: string,
  dateKey: string,
  handlers: PlaylistDetailSubscription,
): Unsubscribe {
  const unsubscribers = [
    onSnapshot(
      tracksByDateQuery(roomId, dateKey),
      (snap) => handlers.onTracks(snap.docs.map((d) => d.data() as Track)),
      handlers.onError,
    ),
    onSnapshot(
      doc(db, 'rooms', roomId, 'days', dateKey),
      (snap) => handlers.onDay(snap.exists() ? (snap.data() as Day) : null),
      handlers.onError,
    ),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export interface SharedPlaylistSubscription {
  onTracks: (tracks: Track[]) => void;
  onError: (error: unknown) => void;
}

/** 방 전체 공동 플레이리스트 — 유튜브 watch_videos 제한에 맞춰 등록 순 50곡까지 구독한다. */
export function subscribeSharedPlaylist(
  roomId: string,
  handlers: SharedPlaylistSubscription,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, 'rooms', roomId, 'tracks'),
      orderBy('order', 'asc'),
      limit(SHARED_PLAYLIST_LIMIT),
    ),
    (snap) => handlers.onTracks(snap.docs.map((d) => d.data() as Track)),
    handlers.onError,
  );
}
