import { appMode } from './runtimeConfig';

export function isMockPreviewEnabled(): boolean {
  return appMode === 'demo';
}
