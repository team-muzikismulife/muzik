import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * Cloud Functions 진입점 (백엔드설계.md §3)
 * 쓰기는 전부 여기를 경유한다. 클라이언트는 Firestore 읽기 전용.
 */

initializeApp();

// 클라이언트도 같은 리전으로 호출해야 한다 (src/lib/firebase.ts FUNCTIONS_REGION)
setGlobalOptions({ region: 'asia-northeast3' });

export { createRoom } from './createRoom';
export { joinRoom } from './joinRoom';
