import { create } from 'zustand';
import { subscribeMembers, subscribeSharedPlaylistItems, subscribeSharedPlaylists } from '@/lib/db';
import { toMessage } from '@/lib/errors';
import { DEFAULT_SHARED_PLAYLIST_ID, DEFAULT_SHARED_PLAYLIST_NAME } from '@/lib/api';
import { getMockAllTracks, getMockRoomState, isMockRoomId } from '@/lib/mockPreview';
import type { Member, SharedPlaylist, SharedPlaylistItem } from '@/types/models';

/**
 * 공동 플리 서버 상태 (docs/배포본복원계획.md §4)
 *
 * 구독이 2단이다: 폴더 목록 → 선택된 폴더의 곡.
 * 선택은 화면이 아니라 여기서 들고 있다 — 목록이 갱신될 때 사라진 폴더를 고르고 있으면
 * 첫 폴더로 되돌려야 하는데, 그 판단이 화면 두 곳에 흩어지면 어긋난다.
 */

type Status = 'loading' | 'ready' | 'empty' | 'error';

interface SharedPlaylistStore {
  status: Status;
  error: string | null;
  playlists: SharedPlaylist[];
  selectedId: string | null;
  items: SharedPlaylistItem[];
  /** 닉네임 해석용 — 담긴 아이템의 recommendedByNickname은 쓰기 시점 스냅샷이다 */
  members: Member[];
  select: (playlistId: string) => void;
  /** uid는 목업 방에서 '나'를 정하는 데만 쓴다 */
  subscribe: (roomId: string, uid?: string | null) => () => void;
}

/** 늦게 도착한 구독 콜백이 최신 구독을 덮어쓰지 않게 하는 세대 번호 */
let seq = 0;

/** 목업 방에서 보여줄 가짜 폴더 — 실제 곡들을 담아둔 것처럼 만든다 */
function mockSnapshot(uid?: string | null): { playlists: SharedPlaylist[]; items: SharedPlaylistItem[] } {
  const tracks = getMockAllTracks(uid);
  const items: SharedPlaylistItem[] = tracks.map((t, i) => ({
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    sourceDateKey: t.dateKey,
    recommendedByUid: t.uid,
    recommendedByNickname: t.nickname,
    embeddable: t.embeddable,
    addedByUid: t.uid,
    addedAt: t.createdAt,
    order: i,
  }));

  return {
    playlists: [
      {
        id: DEFAULT_SHARED_PLAYLIST_ID,
        name: DEFAULT_SHARED_PLAYLIST_NAME,
        createdBy: tracks[0]?.uid ?? 'mock-you',
        createdAt: tracks[0]?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        trackCount: items.length,
        coverVideoId: tracks[0]?.videoId,
      },
    ],
    items,
  };
}

export const useSharedPlaylistStore = create<SharedPlaylistStore>((set, get) => ({
  status: 'loading',
  error: null,
  playlists: [],
  selectedId: null,
  items: [],
  members: [],

  select: (playlistId) => set({ selectedId: playlistId }),

  subscribe: (roomId, uid) => {
    const mySeq = ++seq;
    set({ status: 'loading', error: null, playlists: [], items: [], selectedId: null, members: [] });

    // 목업 방은 Firestore에 없다 — 구독하면 permission-denied로 깨진다(배포본의 버그)
    if (isMockRoomId(roomId)) {
      const { playlists, items } = mockSnapshot(uid);
      set({
        playlists,
        items,
        members: getMockRoomState('', uid).members,
        selectedId: playlists[0]?.id ?? null,
        status: items.length > 0 ? 'ready' : 'empty',
        error: null,
      });
      return () => {};
    }

    const fail = (e: unknown) => {
      if (mySeq !== seq) return;
      set({ status: 'error', error: toMessage(e) });
    };

    let unsubItems: (() => void) | undefined;

    const watchItems = (playlistId: string | null) => {
      unsubItems?.();
      unsubItems = undefined;
      if (!playlistId) {
        set({ items: [] });
        return;
      }
      unsubItems = subscribeSharedPlaylistItems(
        roomId,
        playlistId,
        (items) => {
          if (mySeq !== seq) return;
          set({ items, status: items.length > 0 ? 'ready' : 'empty', error: null });
        },
        fail,
      );
    };

    // 멤버는 닉네임 해석에만 쓴다 — 실패해도 스냅샷 폴백이 있으므로 화면을 막지 않는다
    const unsubMembers = subscribeMembers(
      roomId,
      (members) => {
        if (mySeq !== seq) return;
        set({ members });
      },
      () => {},
    );

    const unsubPlaylists = subscribeSharedPlaylists(
      roomId,
      (playlists) => {
        if (mySeq !== seq) return;
        const current = get().selectedId;
        // 고르고 있던 폴더가 사라졌으면 첫 폴더로 되돌린다
        const next = current && playlists.some((p) => p.id === current) ? current : (playlists[0]?.id ?? null);
        const changed = next !== current;
        set({
          playlists,
          selectedId: next,
          status: playlists.length === 0 ? 'empty' : get().status,
          error: null,
        });
        if (changed || !unsubItems) watchItems(next);
      },
      fail,
    );

    return () => {
      seq += 1;
      unsubItems?.();
      unsubMembers();
      unsubPlaylists();
    };
  },
}));
