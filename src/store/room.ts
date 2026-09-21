import { create } from 'zustand';
import { subscribeDays, subscribeMembers, subscribeRoom, subscribeTracks } from '@/lib/db';
import { toMessage } from '@/lib/errors';
import { getMockRoomState, isMockRoomId } from '@/lib/mockData';
import type { Day, Member, Room, Track } from '@/types/models';
import { refreshMeta } from '@/lib/api';
import { isMockPreviewEnabled } from '@/lib/mockPreview';

let cleanupCurrent: (() => void) | undefined;
const refreshedDates = new Set<string>();

/**
 * 단일 팀 구독 (docs/frontend.md § State Management — 서버 상태)
 * 화면은 이 스토어를 읽기만 한다. 구독은 `subscribe(roomId, dateKey)`가 4개 onSnapshot을
 * 하나의 unsubscribe로 묶어 돌려준다 — 화면은 useFocusEffect에서 그걸 cleanup으로 쓴다.
 */
type Status = 'loading' | 'ready' | 'error';

interface RoomStore {
  room: Room | null;
  members: Member[];
  tracks: Track[]; // 구독 중인 dateKey의 트랙
  days: Day[]; // 곡이 있는 날짜 목록 (날짜 탭)
  status: Status;
  error: string | null;
  fromCache: boolean;
  subscribe: (roomId: string, dateKey: string) => () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  members: [],
  tracks: [],
  days: [],
  status: 'loading',
  error: null,
  fromCache: true,

  subscribe: (roomId, dateKey) => {
    cleanupCurrent?.();
    set({ status: 'loading', error: null, room: null, members: [], tracks: [], days: [], fromCache: true });

    if (isMockRoomId(roomId)) {
      set({ ...getMockRoomState(dateKey), status: 'ready' });
      return () => {};
    }
    if (isMockPreviewEnabled()) {
      set({ status: 'error', error: '시연용 팀만 열 수 있어요. 홈에서 목업 테스트 팀을 선택해 주세요.' });
      return () => {};
    }

    let active = true;
    const unsubs: (() => void)[] = [];
    const cleanup = () => { active = false; unsubs.forEach((u) => u()); if (cleanupCurrent === cleanup) cleanupCurrent = undefined; };
    const loaded = new Set<string>();
    const update = (key: string, value: Partial<RoomStore>) => {
      if (!active) return;
      loaded.add(key);
      set({ ...value, status: loaded.size === 4 ? 'ready' : 'loading' });
    };
    const onErr = (e: unknown) => { if (active) { cleanup(); set({ status: 'error', error: toMessage(e) }); } };

    unsubs.push(
      subscribeRoom(roomId, (room) => room ? update('room', { room }) : onErr(new Error('팀을 찾을 수 없어요. 초대 링크를 확인해 주세요.')), onErr),
      subscribeMembers(roomId, (members) => update('members', { members }), onErr),
      subscribeTracks(roomId, dateKey, (tracks) => update('tracks', { tracks }), onErr, fromCache => { if (active) set({ fromCache }); }),
      subscribeDays(roomId, (days) => update('days', { days }), onErr),
    );

    const refreshKey = `${roomId}:${dateKey}`;
    if (!refreshedDates.has(refreshKey)) {
      refreshedDates.add(refreshKey);
      refreshMeta(roomId, dateKey).catch(() => { refreshedDates.delete(refreshKey); });
    }
    cleanupCurrent = cleanup;
    return cleanup;
  },
}));
