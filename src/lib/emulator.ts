import Constants from 'expo-constants';

/**
 * Emulator Suite 접속 (백엔드설계.md §7)
 *
 * 실기기 Expo Go는 개발 PC의 `localhost`를 볼 수 없다 — 기기 입장에서 localhost는 자기 자신이다.
 * 그래서 Metro가 알려주는 `hostUri`(예: `192.168.0.12:8081`)에서 **개발 PC의 LAN IP**를 뽑아 쓴다.
 * iOS 시뮬레이터는 호스트와 네트워크를 공유하므로 localhost로도 되지만, 분기를 두지 않고 같은 경로를 쓴다.
 */

/** firebase.json의 emulators 포트와 반드시 일치해야 한다 */
export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
} as const;

/**
 * 에뮬레이터를 쓰는가 — 개발 빌드에서 기본 on.
 * 실 Firebase 프로젝트를 보려면 `.env`에 `EXPO_PUBLIC_USE_EMULATOR=false`.
 */
export const useEmulator = __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR !== 'false';

/**
 * 에뮬레이터가 떠 있는 호스트. Metro 호스트와 같은 머신이라고 가정한다.
 * hostUri를 못 읽으면(웹·프로덕션 번들) localhost로 떨어진다.
 */
export function emulatorHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host && host.length > 0 ? host : 'localhost';
}
