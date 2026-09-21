import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), {
    name: 'production-module-boundary',
    apply: 'build',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        const normalized = id.replaceAll('\\', '/');
        if (/\/(?:legacy|examples|tests)\/|\/node_modules\/(?:@firebase|firebase|expo|react-native)(?:\/|-)/.test(normalized)) {
          this.error(`운영 번들 모듈 경계 위반: ${id}`);
        }
      }
    },
  }, VitePWA({
    registerType: 'prompt', injectRegister: false,
    manifest: { id: '/', name: 'MUZIK', short_name: 'MUZIK', lang: 'ko', start_url: '/', scope: '/', display: 'standalone', background_color: '#121212', theme_color: '#121212',
      icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,otf,woff2}'], maximumFileSizeToCacheInBytes: 2000000, cleanupOutdatedCaches: true, navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/auth\/callback/], runtimeCaching: [] },
  })],
  server: { fs: { allow: ['../..'] } },
  build: { sourcemap: false },
});
