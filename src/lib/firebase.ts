import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { EMULATOR_PORTS, emulatorHost, useEmulator } from './emulator';

/**
 * Firebase 초기화 (백엔드설계.md §7 — M1에서 막힐 지점 4개를 여기서 전부 처리한다)
 *
 * 1. **Auth 영속**: `getAuth()`는 RN에서 재시작 시 로그아웃된다. 익명 uid가 날아가면 방 소유권도 날아간다.
 *    → `initializeAuth` + AsyncStorage 영속. (타입 보강: src/types/firebase-auth-rn.d.ts)
 * 2. **Functions 리전**: 빠뜨리면 us-central1로 호출돼 원인 불명의 `internal` 에러가 난다.
 * 3. **Firestore 스트리밍**: Expo Go에서 onSnapshot이 조용히 멈추는 것을 long polling으로 막는다.
 * 4. **에뮬레이터**: 실기기는 localhost를 못 본다 → `emulator.ts`가 LAN IP를 넘긴다.
 */

/** Functions 배포 리전 — 클라이언트 호출도 반드시 같은 리전이어야 한다 */
export const FUNCTIONS_REGION = 'asia-northeast3';

/**
 * 에뮬레이터는 실제 자격 증명이 필요 없다. `demo-` 접두 projectId는 에뮬레이터가
 * **데모 프로젝트**로 인식해 실 리소스에 절대 붙지 않는다 — .env 없이도 개발이 돌아간다.
 */
const DEMO_PROJECT_ID = 'demo-muzik';

function firebaseConfig(): FirebaseOptions {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (useEmulator) {
    return {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
      projectId: projectId ?? DEMO_PROJECT_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:0:web:0',
    };
  }

  if (!projectId) {
    // 프로덕션 번들에서 조용히 빈 config로 뜨면, 첫 쿼리에서야 정체불명의 에러가 난다.
    throw new Error('Firebase 설정이 없습니다. .env를 확인해 주세요 (.env.example 참고)');
  }

  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Fast Refresh로 이 모듈이 다시 평가돼도 앱·서비스는 한 번만 만든다.
 * `initializeAuth`/`initializeFirestore`/`connect*Emulator`는 **두 번 호출하면 던진다** —
 * 이미 만들어져 있으면 만들지 말고 꺼내 쓴다.
 */
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

  const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });

  const db = initializeFirestore(app, {
    // Expo Go에서 onSnapshot이 조용히 멈추는 것을 막는다 (백엔드설계.md §7)
    experimentalForceLongPolling: true,
  });

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
