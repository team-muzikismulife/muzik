#!/usr/bin/env node
/**
 * 웹 배포 파이프라인 (데모 · Spark · Vercel 정적 배포)
 *
 *   node scripts/deploy-web.mjs          # 빌드 + 픽스 + 배포
 *   node scripts/deploy-web.mjs --build  # 빌드 + 픽스만 (배포 안 함)
 *
 * `expo export -p web`가 남기는 두 함정을 매 빌드마다 자동으로 고친다:
 *   1) 아이콘/네비 폰트가 `assets/node_modules/...` 아래에 놓이는데,
 *      Vercel이 경로에 든 `node_modules`를 배포에서 제외한다 → 폰트 404 → 네모 아이콘.
 *      → 폴더를 `assets/vendored/`로 옮기고 번들 참조도 함께 치환.
 *   2) 딥 URL 새로고침 시 상대경로 자산이 엉뚱하게 풀린다 → `<base href="/">` 주입.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const buildOnly = process.argv.includes('--build');
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

console.log('▸ expo export -p web');
fs.rmSync('dist', { recursive: true, force: true });
run('npx expo export -p web');

// 1) assets/node_modules → assets/vendored (Vercel node_modules 제외 회피)
const nm = 'dist/assets/node_modules';
if (fs.existsSync(nm)) {
  fs.renameSync(nm, 'dist/assets/vendored');
  const jsDir = 'dist/_expo/static/js/web';
  let patched = 0;
  for (const f of fs.readdirSync(jsDir).filter((x) => x.endsWith('.js'))) {
    const p = path.join(jsDir, f);
    const before = fs.readFileSync(p, 'utf8');
    const after = before.split('assets/node_modules/').join('assets/vendored/');
    if (after !== before) {
      fs.writeFileSync(p, after);
      patched += 1;
    }
  }
  console.log(`▸ 폰트 경로 vendored로 이전 (JS ${patched}개 패치)`);
}

// 2) <base href="/"> 주입 (딥 URL 상대경로 대응)
const idx = 'dist/index.html';
let html = fs.readFileSync(idx, 'utf8');
if (!html.includes('<base')) {
  html = html.replace('<head>', '<head>\n    <base href="/" />');
  fs.writeFileSync(idx, html);
  console.log('▸ <base href="/"> 주입');
}

// SPA rewrite (정적 배포 시 딥 라우트 → index.html)
fs.writeFileSync(
  'dist/vercel.json',
  JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2),
);

if (buildOnly) {
  console.log('✅ 빌드 완료 (배포 생략). 배포: npx vercel deploy ./dist --prod --yes');
} else {
  console.log('▸ Vercel 배포');
  run('npx vercel deploy ./dist --prod --yes');
}
