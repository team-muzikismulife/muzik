#!/usr/bin/env node
/**
 * 웹 빌드 파이프라인 (운영 기본 · 데모는 명시 선택)
 *
 *   node scripts/deploy-web.mjs          # 운영 설정 검사 + 빌드 (자동 배포 없음)
 *   node scripts/deploy-web.mjs --build  # 빌드 + 픽스만 (배포 안 함)
 *   --mock-preview                       # 발표 테스트용 목업 팀을 배포 번들에 포함
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
import { load } from '@expo/env';
import { validateEnv } from './validate-env.mjs';

const mockPreview = process.argv.includes('--mock-preview');
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

function runExpoExport() {
  run('npx expo export -p web --clear');
}

function copyDirectoryContents(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(source, target);
      continue;
    }
    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}

function moveDirectory(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    console.log(`▸ 자산 폴더 rename 대신 copy 사용 (${error?.code ?? 'unknown'})`);
    if (error?.code !== 'EPERM' && error?.code !== 'EXDEV') throw error;
    copyDirectoryContents(from, to);
    try {
      fs.rmSync(from, { recursive: true, force: true });
    } catch {
      console.log('▸ 원본 node_modules 자산 폴더 정리는 생략 (vendored 복사본 사용)');
    }
  }
}

load(process.cwd(), { silent: true });
const mode = mockPreview ? 'demo' : process.argv.includes('--emulator') ? 'emulator' : 'production';
validateEnv(process.env, mode);
process.env.EXPO_PUBLIC_APP_MODE = mode;
console.log(`▸ 앱 모드: ${mode}`);
if (process.argv.includes('--check')) process.exit(0);

console.log('▸ expo export -p web');
const output = path.resolve('dist');
if (path.dirname(output) !== process.cwd()) throw new Error('출력 경로 확인 실패');
fs.rmSync(output, { recursive: true, force: true });
runExpoExport();

// 1) assets/node_modules → assets/vendored (Vercel node_modules 제외 회피)
const nm = 'dist/assets/node_modules';
if (fs.existsSync(nm)) {
  moveDirectory(nm, 'dist/assets/vendored');
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

console.log('빌드 완료. 기존 Vercel 프로젝트 연결을 확인한 뒤 저장소 루트에서 배포하세요.');
