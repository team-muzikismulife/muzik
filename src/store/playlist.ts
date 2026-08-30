import { create } from 'zustand';
import {
  fetchPlaylistDetail,
  subscribePlaylistDetail,
  type PlaylistDetailSubscription,
} from '@/lib/db';
import { todayKey } from '@/lib/date';
import { toMessage } from '@/lib/errors';
import type { Day, Track } from '@/types/models';

/**
 * 날짜별 플레이리스트 상세 서버 상태.
 *
 * 오늘은 실시간으로 바뀌고, 과거는 1회 조회한다. 이전 날짜의 늦은 응답이 현재 화면을
 * 덮지 않도록 seq로 응답 소유권을 확인한다.
 */

type Status = 'loading' | 'ready' | 'empty' | 'error';

interface LoadedFlags {
  tracks: boolean;
  day: boolean;
}

interface PlaylistStore {
  status: Status;
  error: string | null;
  tracks: Track[];
  day: Day | null;
  load: (roomId: string, dateKey: string) => () => void;
}

let requestSeq = 0;

const emptyFlags = (): LoadedFlags => ({
  tracks: false,
  day: false,
});

function allLoaded(flags: LoadedFlags): boolean {
  return flags.tracks && flags.day;
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  status: 'loading',
  error: null,
  tracks: [],
  day: null,

  load: (roomId, dateKey) => {
    const seq = ++requestSeq;
    const live = dateKey === todayKey();

    set({ status: 'loading', error: null, tracks: [], day: null });

    const markReady = () => {
      const tracks = get().tracks;
      set({ status: tracks.length > 0 ? 'ready' : 'empty', error: null });
    };

    const fail = (error: unknown) => {
      if (seq !== requestSeq) return;
      requestSeq += 1;
      set({ status: 'error', error: toMessage(error) });
    };

    if (!live) {
      fetchPlaylistDetail(roomId, dateKey)
        .then((data) => {
          if (seq !== requestSeq) return;
          set({ tracks: data.tracks, day: data.day });
          markReady();
        })
        .catch(fail);

      return () => {
        requestSeq += 1;
      };
    }

    const flags = emptyFlags();
    const markLoaded = (key: keyof LoadedFlags) => {
      if (seq !== requestSeq) return;
      flags[key] = true;
      if (allLoaded(flags)) markReady();
    };

    const handlers: PlaylistDetailSubscription = {
      onTracks: (tracks) => {
        if (seq !== requestSeq) return;
        set({ tracks });
        markLoaded('tracks');
      },
      onDay: (day) => {
        if (seq !== requestSeq) return;
        set({ day });
        markLoaded('day');
      },
      onError: fail,
    };

    const unsubscribe = subscribePlaylistDetail(roomId, dateKey, handlers);

    return () => {
      requestSeq += 1;
      unsubscribe();
    };
  },
}));
