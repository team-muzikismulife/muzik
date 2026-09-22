export type AppMode = 'production' | 'demo' | 'emulator';

export const appMode = (process.env.EXPO_PUBLIC_APP_MODE ?? 'production') as AppMode;
if (!['production', 'demo', 'emulator'].includes(appMode)) {
  throw new Error('EXPO_PUBLIC_APP_MODE 설정을 확인해 주세요.');
}
const legacyMock = process.env.EXPO_PUBLIC_ENABLE_MOCK_PREVIEW;
const legacyEmulator = process.env.EXPO_PUBLIC_USE_EMULATOR;
if ((legacyMock && !['0', 'false'].includes(legacyMock)) ||
    (legacyEmulator && !['0', 'false'].includes(legacyEmulator))) {
  throw new Error('이전 목업/에뮬레이터 설정을 제거하고 APP_MODE만 지정해 주세요.');
}

export function firebaseConfig() {
  if (appMode !== 'production') {
    return { apiKey: 'demo-api-key', projectId: 'demo-muzik', appId: '1:0:web:0' };
  }
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((v) => !v?.trim()) || config.projectId?.startsWith('demo-')) {
    throw new Error('운영 Firebase 설정이 없거나 데모 프로젝트입니다. 배포 설정을 확인해 주세요.');
  }
  return config;
}
