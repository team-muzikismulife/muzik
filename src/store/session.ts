import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { create } from 'zustand';
import { auth } from '@/lib/firebase';
import { toMessage } from '@/lib/errors';

/**
 * 세션 — 익명 로그인으로 얻은 uid와, 마지막에 쓴 닉네임 (docs/온보딩구현계획.md §1)
 *
 * uid 영속은 이 스토어가 아니라 **Firebase Auth**가 한다(AsyncStorage 영속성, src/lib/firebase.ts).
 * 그래서 여기서 uid를 따로 저장하지 않는다 — 두 곳에 저장하면 어긋난다.
 *
 * 닉네임은 **방별 속성**이라(백엔드설계.md §1) 전역 닉네임이 없다.
 * 마지막에 쓴 닉네임만 로컬에 기억해 두고, 온보딩 인사말과 팀 개설·입장 폼의 기본값으로 쓴다.
 */

const NICKNAME_KEY = 'muzik.lastNickname';

type SessionStatus = 'loading' | 'ready' | 'error';

interface SessionStore {
  uid: string | null;
  status: SessionStatus;
  /** 인증 실패 시 사용자에게 보여줄 한국어 문구 */
  error: string | null;
  lastNickname: string | null;
  /** 앱 시작 시 1회. 구독 해제 함수를 돌려준다 */
  bootstrap: () => () => void;
  /** 인증 실패 후 재시도 */
  retry: () => void;
  setLastNickname: (nickname: string) => void;
}

/** 익명 로그인 — 이미 로그인돼 있으면 onAuthStateChanged가 먼저 uid를 준다 */
function signIn(set: (partial: Partial<SessionStore>) => void) {
  signInAnonymously(auth).catch((e: unknown) => {
    set({ status: 'error', error: toMessage(e) });
  });
}

export const useSessionStore = create<SessionStore>((set) => ({
  uid: null,
  status: 'loading',
  error: null,
  lastNickname: null,

  bootstrap: () => {
    AsyncStorage.getItem(NICKNAME_KEY)
      .then((nickname) => set({ lastNickname: nickname }))
      .catch(() => {
        // 닉네임 복원 실패는 치명적이지 않다 — 인사말만 빠지고 앱은 돈다
      });

    /**
     * 첫 콜백은 **영속된 세션 복원이 끝난 뒤** 온다. 그래서 여기서 user가 null이면
     * "복원할 세션이 없다"는 뜻이고, 그때만 새 익명 계정을 만든다.
     * (복원 전에 signInAnonymously를 부르면 uid가 매번 새로 발급된다)
     */
    return onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          set({ uid: user.uid, status: 'ready', error: null });
          return;
        }
        signIn(set);
      },
      (e: unknown) => set({ status: 'error', error: toMessage(e) }),
    );
  },

  retry: () => {
    set({ status: 'loading', error: null });
    signIn(set);
  },

  setLastNickname: (nickname) => {
    set({ lastNickname: nickname });
    AsyncStorage.setItem(NICKNAME_KEY, nickname).catch(() => {
      // 다음 실행에서 기본값이 안 채워질 뿐이다 — 실패해도 흐름을 막지 않는다
    });
  },
}));
