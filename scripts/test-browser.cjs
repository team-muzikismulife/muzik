const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

async function staticServer(root) {
  const url = new URL(root);
  assert(['localhost', '127.0.0.1'].includes(url.hostname));
  const directory = path.resolve(process.env.TEST_STATIC_DIR);
  const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };
  const server = http.createServer(async (req, res) => {
    try {
      const requested = path.resolve(directory, '.' + decodeURIComponent(new URL(req.url, root).pathname));
      if (!requested.startsWith(directory + path.sep) && requested !== directory) { res.writeHead(403).end(); return; }
      const file = await fs.stat(requested).then(stat => stat.isFile() ? requested : path.join(directory, 'index.html')).catch(() => path.join(directory, 'index.html'));
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(url.port), url.hostname, resolve); });
  return server;
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const a = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const b = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const first = await a.newPage(); const second = await b.newPage();
  const errors = [];
  for (const p of [first,second]) p.on('pageerror', e => errors.push(e.message));
  const root = process.env.TEST_WEB_URL || 'http://localhost:8083';
  let server;
  try {
    if (process.env.TEST_STATIC_DIR) server = await staticServer(root);
    await first.goto(root);
    await first.getByRole('button', { name: '새로운 팀 개설하기' }).click();
    await first.getByLabel('팀 이름 입력').fill('브라우저 검증 모임');
    await first.getByLabel('닉네임 입력').fill('대표');
    await first.getByRole('button', { name: '팀 개설하기', exact: true }).click();
    await first.getByRole('button', { name: '초대 코드 복사' }).waitFor();
    const code = (await first.locator('[aria-label^="초대 코드 "]').filter({ hasText: /^[A-Z2-9]{6}$/ }).getAttribute('aria-label')).replace('초대 코드 ', '').replaceAll(' ', '');
    assert.match(code, /^[A-Z2-9]{6}$/);
    await first.getByRole('button', { name: '초대 코드 복사' }).click();
    assert.equal(await first.evaluate(() => navigator.clipboard.readText()),code);
    await first.getByRole('button', { name: '팀으로 이동' }).click();
    await first.waitForURL(/\/room\/[A-Za-z0-9]+$/);
    const roomUrl = first.url();
    await second.goto(`${root}/r/BAD`);
    await second.getByRole('button', { name: '코드 다시 입력' }).click();
    assert.equal(await second.getByLabel('초대 코드 입력').inputValue(), 'BAD');
    console.log('PASS 잘못된 초대 코드 보존/수정 경로');
    await second.goto(`${root}/r/${code}`);
    await second.getByLabel('닉네임 입력').fill('참여자');
    await second.getByRole('button', { name: '입장하기', exact: true }).click();
    await second.waitForURL(roomUrl);
    await first.getByText('참여자', { exact: true }).waitFor();
    console.log('PASS 독립 브라우저 팀 생성/초대 링크/닉네임 참여/실시간 멤버');
    await first.getByRole('button', { name: '오늘의 곡 추가하기' }).click();
    await first.getByLabel('유튜브 링크 입력').fill('https://youtu.be/dQw4w9WgXcQ');
    await first.getByLabel('코멘트 입력').fill('브라우저에서 올린 첫 곡');
    await first.route('**/registerTrack', route => route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({error:{status:'UNAVAILABLE',message:'검증용 일시 장애'}}) }));
    await first.getByRole('button', { name: '곡 등록하기' }).click();
    await first.getByText('네트워크 연결 후 다시 시도해 주세요.', { exact: true }).waitFor();
    assert.equal(await first.getByLabel('코멘트 입력').inputValue(), '브라우저에서 올린 첫 곡');
    await first.unroute('**/registerTrack');
    console.log('PASS 저장 실패 입력 보존/재시도');
    await first.getByRole('button', { name: '곡 등록하기' }).click();
    await first.waitForURL(url => url.pathname === new URL(roomUrl).pathname);
    await second.getByText('브라우저에서 올린 첫 곡', { exact: true }).waitFor();
    console.log('PASS 서버 영상 미리보기 fixture/등록/다른 브라우저 실시간 표시');
    await first.reload();
    await first.getByRole('button', { name: '내 곡 수정 또는 삭제' }).waitFor();
    await first.goto(root);
    await first.getByText('브라우저 검증 모임', { exact: true }).waitFor();
    console.log('PASS 새로고침 익명 계정/참여팀 복원');
    await first.goto(roomUrl + '/shared-playlist');
    await first.waitForURL(roomUrl);
    assert.equal(await first.getByLabel('공동 플리', { exact: true }).count(),0);
    console.log('PASS 후속 기능 직접 URL 및 메뉴 차단');
    await second.getByLabel('이 곡 내 화면에서 숨기기').click();
    await second.getByText('대표님의 곡은 숨겨졌어요').waitFor();
    await first.getByText('브라우저에서 올린 첫 곡', { exact: true }).waitFor();
    console.log('PASS 개인 숨김 격리');
    await first.goto(`${root}/r/${code}`);
    await first.getByLabel('닉네임 입력').fill('새대표');
    await first.getByRole('button', { name: '입장하기', exact: true }).click();
    await first.waitForURL(roomUrl);
    await first.getByText('새대표', { exact: true }).waitFor();
    await second.getByText('새대표님의 곡은 숨겨졌어요').waitFor();
    console.log('PASS 재입장 닉네임 변경/기존 곡의 현재 멤버명 반영');
    await first.getByLabel('곡 신고하기').click();
    await first.getByRole('button', { name: '제출', exact: true }).click();
    await first.getByText('접수했어요. 운영자가 확인할게요.').waitFor();
    await first.goto(root + '/feedback');
    await first.getByLabel('의견', { exact: true }).fill('모바일 베타 검증 의견');
    await first.getByRole('button', { name: '제출', exact: true }).click();
    await first.getByText('접수했어요. 운영자가 확인할게요.').waitFor();
    console.log('PASS 신고/피드백 인앱 서버 접수');
    await first.goto(roomUrl);
    await first.getByText('브라우저에서 올린 첫 곡', { exact: true }).waitFor();
    assert(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await first.waitForFunction(() => Array.from(document.images).some(i => i.naturalWidth > 120), null, { timeout: 10000 });
    await first.screenshot({ path: 'docs/beta-room-mobile.png', fullPage: true, animations: 'disabled' });
    await first.getByLabel('해당 날짜 플레이리스트 열기').click();
    await first.waitForURL(/\/playlist\//);
    await first.getByRole('button', { name: /1번째 곡/ }).waitFor();
    assert.match(await first.getByRole('button', { name: /1번째 곡/ }).getAttribute('aria-label'), /새대표님 추천/);
    await first.getByLabel('에뮬레이터 검증용 곡 유튜브에서 개별 재생').last().waitFor();
    await first.waitForFunction(() => Array.from(document.images).some(i => i.naturalWidth > 120), null, { timeout: 10000 });
    await first.screenshot({ path: 'docs/beta-playlist-mobile.png', fullPage: true, animations: 'disabled' });
    await first.setViewportSize({ width: 1280, height: 900 });
    assert(await first.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await first.screenshot({ path: 'docs/beta-playlist-desktop.png', fullPage: true });
    console.log('PASS 날짜별 플리/개별 재생 진입점/모바일 폭');
    assert.deepEqual(errors, []);
    console.log('완료: Edge headless 독립 컨텍스트 2개, 390/375px. 외부 YouTube 실제 재생/실기기는 미검증.');
  } catch(e) {
    console.log('URL',first.url(),second.url());
    console.log((await first.locator('body').innerText()).slice(0,3500));
    await first.screenshot({path:'docs/beta-browser-failure.png',fullPage:true});
    throw e;
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
