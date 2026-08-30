import { create } from 'zustand';
import {
  subscribeRoomHome,
  type RoomWithId,
  type RoomHomeSubscription,
} from '@/lib/db';
import { toMessage } from '@/lib/errors';
import type { Day, Member, Track } from '@/types/models';

/**
 * 방 홈 서버 상태.
 *
 * Firestore 구독은 화면 포커스 중에만 시작되지만, 스냅샷 병합과 에러 처리는 store가 맡는다.
 * room/members/tracks/day 네 구독이 모두 첫 응답을 준 뒤 ready로 바꿔 중간 상태 깜빡임을 막는다.
 */

type Status = 'loading' | 'ready' | 'empty' | 'error';

interface LoadedFlags {
  room: boolean;
  members: boolean;
  tracks: boolean;
  day: boolean;
}

interface RoomStore {
  status: Status;
  error: string | null;
  room: RoomWithId | null;
  members: Member[];
  todayTracks: Track[];
  todayDay: Day | null;
  subscribe: (roomId: string, dateKey: string) => () => void;
}

let subscriptionSeq = 0;

const emptyFlags = (): LoadedFlags => ({
  room: false,
  members: false,
  tracks: false,
  day: false,
});

function allLoaded(flags: LoadedFlags): boolean {
  return flags.room && flags.members && flags.tracks && flags.day;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  status: 'loading',
  error: null,
  room: null,
  members: [],
  todayTracks: [],
  todayDay: null,

  subscribe: (roomId, dateKey) => {
    const seq = ++subscriptionSeq;
    const flags = emptyFlags();

    set({
      status: 'loading',
      error: null,
      room: null,
      members: [],
      todayTracks: [],
      todayDay: null,
    });

    const markLoaded = (key: keyof LoadedFlags) => {
      if (seq !== subscriptionSeq) return;
      flags[key] = true;
      if (!allLoaded(flags)) return;

      set({ status: get().room ? 'ready' : 'empty', error: null });
    };

    const onError = (error: unknown) => {
      if (seq !== subscriptionSeq) return;
      subscriptionSeq += 1;
      set({ status: 'error', error: toMessage(error) });
    };

    const handlers: RoomHomeSubscription = {
      onRoom: (room) => {
        if (seq !== subscriptionSeq) return;
        set({ room });
        markLoaded('room');
      },
      onMembers: (members) => {
        if (seq !== subscriptionSeq) return;
        set({ members });
        markLoaded('members');
      },
      onTracks: (tracks) => {
        if (seq !== subscriptionSeq) return;
        set({ todayTracks: tracks });
        markLoaded('tracks');
      },
      onDay: (day) => {
        if (seq !== subscriptionSeq) return;
        set({ todayDay: day });
        markLoaded('day');
      },
      onError,
    };

    const unsubscribe = subscribeRoomHome(roomId, dateKey, handlers);

    return () => {
      subscriptionSeq += 1;
      unsubscribe();
    };
  },
}));
