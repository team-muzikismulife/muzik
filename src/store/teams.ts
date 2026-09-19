import { create } from 'zustand';
import { fetchMyTeams, type TeamSummary } from '@/lib/db';
import { toMessage } from '@/lib/errors';
import { MOCK_ROOM_ID, getMockTeamSummary, isMockPreviewEnabled } from '@/lib/mockPreview';

/**
 * 참여 중인 팀 목록 (온보딩)
 *
 * 실시간 구독(onSnapshot)이 아니라 **포커스 시 1회 조회**다.
 * 방 N개를 동시에 구독하면 읽기 비용이 방 수에 비례해 늘어나는데,
 * 온보딩에서 실시간성이 필요한 정보는 없다. 실시간은 방 홈(members)에서 한다.
 */

type Status = 'loading' | 'ready' | 'error';

interface TeamsStore {
  status: Status;
  teams: TeamSummary[];
  error: string | null;
  load: (uid: string) => Promise<void>;
}

export const useTeamsStore = create<TeamsStore>((set) => ({
  status: 'loading',
  teams: [],
  error: null,

  load: async (uid) => {
    // 재조회 시 목록을 비우지 않는다 — 화면이 깜빡이며 빈 상태로 튀는 것을 막는다
    set({ status: 'loading', error: null });
    try {
      const teams = await fetchMyTeams(uid);
      // 목업 팀은 항상 맨 앞. 같은 id가 실제로 있을 리 없지만, 중복 카드가 뜨는 것보다 걸러두는 편이 안전하다
      const withMock = isMockPreviewEnabled()
        ? [getMockTeamSummary(uid), ...teams.filter((t) => t.id !== MOCK_ROOM_ID)]
        : teams;
      set({ teams: withMock, status: 'ready' });
    } catch (e: unknown) {
      // 목업 프리뷰에선 조회 실패가 곧 빈 화면이 되면 안 된다 — 데모를 열 수 있는 게 우선이다
      if (isMockPreviewEnabled()) {
        set({ teams: [getMockTeamSummary(uid)], status: 'ready', error: null });
        return;
      }
      set({ status: 'error', error: toMessage(e) });
    }
  },
}));
