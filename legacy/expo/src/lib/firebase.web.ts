import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { EMULATOR_PORTS, emulatorHost, useEmulator } from './emulator';
import { firebaseConfig } from './runtimeConfig';
import { appMode } from './runtimeConfig';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

/**
 * Firebase 초기화 — **웹 전용**. (네이티브는 firebase.ts, Metro가 플랫폼별로 고른다)
 *
 * firebase.ts는 RN용이라 `getReactNativePersistence(AsyncStorage)`를 쓰는데, 이 함수는
 * 브라우저 빌드에 존재하지 않아 웹에서 모듈 로드 즉시 크래시한다(흰 화면).
 * 웹에서는 `getAuth`가 기본으로 브라우저 로컬 영속(IndexedDB)을 하므로 그대로 쓰면 된다 —
 * 새로고침·재방문에도 같은 익명 uid가 유지된다.
 *
 * 나머지 계약(export 이름·config 규칙)은 firebase.ts와 동일하게 맞춘다.
 */

export const FUNCTIONS_REGION = 'asia-northeast3';


function createServices(): { auth: Auth; db: Firestore; functions: Functions } {
  if (getApps().length > 0) {
    const app = getApp();
    return {
      auth: getAuth(app),
      db: getFirestore(app),
      functions: getFunctions(app, FUNCTIONS_REGION),
    };
  }

  const app = initializeApp(firebaseConfig());
  if (appMode === 'production') {
    const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) throw new Error('운영 App Check 설정이 없습니다.');
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  // 웹은 getAuth가 기본으로 브라우저 로컬 영속을 한다 (RN처럼 initializeAuth를 부를 필요가 없다)
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);

  if (useEmulator) {
    const host = emulatorHost();
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, host, EMULATOR_PORTS.functions);
  }

  return { auth, db, functions };
}

export const { auth, db, functions } = createServices();
