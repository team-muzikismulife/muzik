import { create } from 'zustand';
import { subscribeSharedPlaylist, type SharedPlaylistSubscription } from '@/lib/db';
import { toMessage } from '@/lib/errors';
import type { Track } from '@/types/models';

/**
 * 공동 공유 플레이리스트 서버 상태.
 *
 * 방 전체 tracks를 포커스 중에만 구독한다. 유튜브 핸드오프 제한 때문에 DB 레이어에서 50곡으로
 * 제한하며, 화면은 받은 큐를 그대로 재생 순서로 사용한다.
 */

type Status = 'loading' | 'ready' | 'empty' | 'error';

interface SharedPlaylistStore {
  status: Status;
  error: string | null;
  tracks: Track[];
  subscribe: (roomId: string) => () => void;
}

let subscriptionSeq = 0;

export const useSharedPlaylistStore = create<SharedPlaylistStore>((set) => ({
  status: 'loading',
  error: null,
  tracks: [],

  subscribe: (roomId) => {
    const seq = ++subscriptionSeq;
    let liveUnsubscribe: (() => void) | undefined;

    set({ status: 'loading', error: null, tracks: [] });

    const fail = (error: unknown) => {
      if (seq !== subscriptionSeq) return;
      subscriptionSeq += 1;
      liveUnsubscribe?.();
      liveUnsubscribe = undefined;
      set({ status: 'error', error: toMessage(error) });
    };

    const handlers: SharedPlaylistSubscription = {
      onTracks: (tracks) => {
        if (seq !== subscriptionSeq) return;
        set({ tracks, status: tracks.length > 0 ? 'ready' : 'empty', error: null });
      },
      onError: fail,
    };

    liveUnsubscribe = subscribeSharedPlaylist(roomId, handlers);

    return () => {
      subscriptionSeq += 1;
      liveUnsubscribe?.();
      liveUnsubscribe = undefined;
    };
  },
}));
