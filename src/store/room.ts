import { create } from 'zustand';
import { subscribeMembers, subscribeRoom, subscribeTracks } from '@/lib/db';
import { toMessage } from '@/lib/errors';
import type { Member, Room, Track } from '@/types/models';

/**
 * 단일 팀 구독 (docs/frontend.md § State Management — 서버 상태)
 * 화면은 이 스토어를 읽기만 한다. 구독은 `subscribe(roomId, dateKey)`가 3개 onSnapshot을
 * 하나의 unsubscribe로 묶어 돌려준다 — 화면은 useFocusEffect에서 그걸 cleanup으로 쓴다.
 */
type Status = 'loading' | 'ready' | 'error';

interface RoomStore {
  room: Room | null;
  members: Member[];
  tracks: Track[]; // 구독 중인 dateKey의 트랙
  status: Status;
  error: string | null;
  subscribe: (roomId: string, dateKey: string) => () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  members: [],
  tracks: [],
  status: 'loading',
  error: null,

  subscribe: (roomId, dateKey) => {
    set({ status: 'loading', error: null });
    const onErr = (e: unknown) => set({ status: 'error', error: toMessage(e) });

    const unsubs = [
      subscribeRoom(roomId, (room) => set({ room, status: 'ready' }), onErr),
      subscribeMembers(roomId, (members) => set({ members }), onErr),
      subscribeTracks(roomId, dateKey, (tracks) => set({ tracks }), onErr),
    ];

    return () => unsubs.forEach((u) => u());
  },
}));
