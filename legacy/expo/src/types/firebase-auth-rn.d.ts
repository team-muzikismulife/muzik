import type { Persistence } from 'firebase/auth';

/**
 * `getReactNativePersistence`는 firebase v11의 **RN 런타임 빌드에만** 존재하고
 * 타입 진입점(`firebase/auth` → `dist/auth/index.d.ts`)에서는 빠져 있다.
 * (v10의 `firebase/auth/react-native` 서브패스는 v11에서 제거됐다 — 백엔드설계.md §7)
 *
 * 이 보강이 없으면 `initializeAuth`에 RN 영속성을 넘길 수 없고,
 * 영속성이 없으면 앱 재시작마다 익명 uid가 새로 발급된다 = **방 소유권 소멸**.
 *
 * firebase가 타입을 고치면 여기서 중복 선언 에러가 난다 → 그때 이 파일을 지운다.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
