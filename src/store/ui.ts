import { create } from 'zustand';
import { duration } from '@/theme/tokens';

/**
 * 전역 UI 상태 (docs/frontend.md § State Management)
 * 토스트 = 오프라인·실패 안내의 단일 채널. alert() 금지.
 */
interface ToastState {
  message: string | null;
  /** 같은 메시지를 연달아 띄워도 리렌더되도록 하는 키 */
  seq: number;
}

interface UiStore extends ToastState {
  showToast: (message: string) => void;
  hideToast: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiStore>((set) => ({
  message: null,
  seq: 0,
  showToast: (message) => {
    if (timer) clearTimeout(timer);
    set((s) => ({ message, seq: s.seq + 1 }));
    timer = setTimeout(() => set({ message: null }), duration.toast);
  },
  hideToast: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));

/** 컴포넌트 밖(=api 레이어)에서도 부를 수 있는 단축 */
export const toast = (message: string) => useUiStore.getState().showToast(message);
