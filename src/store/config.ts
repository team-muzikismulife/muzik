import { create } from 'zustand';
import { subscribeConfig } from '@/lib/db';

/**
 * 원격 설정(킬스위치) — 앱 시작 시 1회 구독 (유튜브연동설계 §3-3).
 * 지금은 핸드오프 모드 하나뿐. 유튜브가 watch_videos를 막으면 `config/app` 문서만 바꿔
 * 배포 없이 첫 곡 재생으로 전환한다.
 */
export type HandoffMode = 'watch_videos' | 'first_video';

interface ConfigStore {
  handoffMode: HandoffMode;
  /** _layout에서 마운트 시 1회 호출 — 반환값을 cleanup으로 쓴다 */
  subscribe: () => () => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  handoffMode: 'watch_videos', // 안전 기본값 — 문서·권한이 없어도 전체 핸드오프
  subscribe: () =>
    subscribeConfig(
      (handoffMode) => set({ handoffMode }),
      () => set({ handoffMode: 'watch_videos' }), // 읽기 실패 시 기본값 유지 (재생을 막지 않는다)
    ),
}));
