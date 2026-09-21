export function validateEnv(env, mode = 'production') {
  if (!['production', 'demo', 'emulator'].includes(mode)) throw new Error('올바르지 않은 앱 모드');
  for (const key of ['EXPO_PUBLIC_ENABLE_MOCK_PREVIEW', 'EXPO_PUBLIC_USE_EMULATOR']) {
    if (env[key] && !['false', '0'].includes(env[key])) throw new Error(`${key}: 이전 설정을 제거하세요`);
  }
  if (mode !== 'production') return;
  const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].map(k => `EXPO_PUBLIC_FIREBASE_${k}`);
  required.push('EXPO_PUBLIC_RECAPTCHA_SITE_KEY');
  const missing = required.filter(k => !env[k]?.trim());
  if (missing.length) throw new Error(`운영 설정 누락: ${missing.join(', ')}`);
  if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID.startsWith('demo-')) throw new Error('운영에서 demo 프로젝트 사용 금지');
  if (env.EXPO_PUBLIC_APP_MODE && env.EXPO_PUBLIC_APP_MODE !== mode) throw new Error('운영 빌드와 APP_MODE 불일치');
}
