const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const directory = path.resolve(process.env.TEST_STATIC_DIR || 'dist');
const failures = [];
const decoder = { observations: 0, calls: 0 };
const nativeParser = { observations: 0, calls: 0 };
const sources = new Map();
let browser;
let server;
const deadline = setTimeout(() => { console.error('URL regression exceeded 180s'); process.exit(1); }, 180000);

async function collectCoverage(cdp) {
  const coverage = await cdp.send('Profiler.takePreciseCoverage');
  for (const script of coverage.result.filter(item => item.url.includes('/_expo/static/js/web/'))) {
    let source = sources.get(script.url);
    if (!source) { source = (await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId })).scriptSource; sources.set(script.url, source); }
    for (const [text, counter] of [['Expected `encodedURI`', decoder], ["https://phony.example').searchParams", nativeParser]]) {
      const marker = source.indexOf(text);
      if (marker < 0) continue;
      assert.equal(source.lastIndexOf(text), marker, 'coverage marker is no longer unique; review bundle mapping');
      // The narrowest V8 function containing each unique marker identifies its implementation.
      const functions = script.functions.filter(fn => fn.ranges[0].startOffset <= marker && fn.ranges[0].endOffset > marker);
      functions.sort((a, b) => (a.ranges[0].endOffset - a.ranges[0].startOffset) - (b.ranges[0].endOffset - b.ranges[0].startOffset));
      assert(functions.length, 'implementation exists but its function coverage is missing');
      counter.observations++;
      counter.calls += functions[0].ranges[0].count;
    }
  }
}

(async () => {
  // Raw malformed route segments must still receive the SPA, rather than a test-server 500.
  server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const target = path.resolve(directory, '.' + pathname);
      if (!target.startsWith(directory + path.sep) && target !== directory) return res.writeHead(403).end();
      const file = await fs.stat(target).then(stat => stat.isFile() ? target : path.join(directory, 'index.html')).catch(() => path.join(directory, 'index.html'));
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const external = new Set();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
    external.add(url.origin);
    return route.abort();
  });
  const setup = await context.newPage();
  setup.setDefaultTimeout(10000);
  await setup.goto(root);
  await setup.getByRole('button', { name: '새로운 팀 개설하기' }).click();
  await setup.getByLabel('팀 이름 입력').fill('URL 검증 모임');
  await setup.getByLabel('닉네임 입력').fill('링크검증');
  await setup.getByRole('button', { name: '팀 개설하기', exact: true }).click();
  const code = (await setup.locator('[aria-label^="초대 코드 "]').filter({ hasText: /^[A-Z2-9]{6}$/ }).getAttribute('aria-label')).replace('초대 코드 ', '').replaceAll(' ', '');
  await setup.getByRole('button', { name: '팀으로 이동' }).click();
  await setup.waitForURL(/\/room\/[A-Za-z0-9]+$/);
  const roomPath = new URL(setup.url()).pathname;
  const date = '2026-05-15';
  await setup.close();
  const home = page => page.getByRole('button', { name: '새로운 팀 개설하기' }).waitFor();
  const invite = page => page.getByText(`초대 코드 ${code}`, { exact: true }).waitFor();
  const room = page => page.getByText('서버에서 최신 곡을 받았어요', { exact: true }).waitFor();
  const playlist = page => page.getByText('5월 15일의 플레이리스트가 비어 있어요.', { exact: true }).waitFor();
  const invalidCode = async page => {
    await page.getByRole('button', { name: '코드 다시 입력' }).click();
    assert((await page.getByLabel('초대 코드 입력').inputValue()).length > 0, 'invalid code was lost');
  };
  let capturedInvalid = false;
  const invalidLink = async page => {
    await page.getByText('링크를 확인해 주세요', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.env.TEST_SCREENSHOTS && !capturedInvalid) {
      capturedInvalid = true;
      await fs.mkdir('scratch', { recursive: true });
      await page.screenshot({ path: 'scratch/url-invalid-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: 'scratch/url-invalid-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByRole('button', { name: '팀 목록으로', exact: true }).click();
    await home(page);
    assert.equal(new URL(page.url()).pathname, '/');
  };
  const selectedDate = async page => {
    await room(page);
    await page.getByLabel('해당 날짜 플레이리스트 열기').click();
    await page.waitForURL(`${root}${roomPath}/playlist/${date}`);
    await playlist(page);
  };
  const cases = [];
  const queries = ['x=hello%20world', 'x=%', 'x=%GG', 'x=%E0%A4%A', 'x=%C0%AF%ED%A0%80%FF', 'x=%252F%253F%2525', 'x=one&x=two', `x=${'%FF'.repeat(512)}${'%'.repeat(1024)}`];
  for (const [name, route, check] of [['home', '/', home], ['invite', `/r/${code}`, invite], ['room', roomPath, room], ['playlist', `${roomPath}/playlist/${date}`, playlist]]) {
    for (const [index, query] of queries.entries()) cases.push({ name: `${name}-query-${index}`, route: `${route}?${query}`, check, pathname: route });
  }
  cases.push(
    { name: 'invite-encoded-code', route: `/r/%${code.charCodeAt(0).toString(16)}${code.slice(1)}`, check: invite },
    { name: 'invite-query-cannot-replace-path', route: `/r/${code}?code=BAD&code=OTHER`, check: invite },
    { name: 'join-duplicate-code', route: `/room/join?code=${code}&code=OTHER`, check: async page => assert.equal(await page.getByLabel('초대 코드 입력').inputValue(), code) },
    { name: 'room-duplicate-date', route: `${roomPath}?date=${date}&date=2026-05-16`, check: selectedDate },
    { name: 'room-invalid-date', route: `${roomPath}?date=%FF`, check: invalidLink },
    { name: 'room-invalid-calendar-date', route: `${roomPath}?date=2026-02-30`, check: invalidLink },
    { name: 'playlist-query-cannot-replace-path', route: `${roomPath}/playlist/${date}?dateKey=BAD&dateKey=OTHER&id=other`, check: playlist },
    { name: 'invite-malformed-percent', route: '/r/%', check: invalidCode },
    { name: 'invite-invalid-utf8', route: '/r/%FF', check: invalidCode },
    { name: 'invite-encoded-slash', route: '/r/ABC%2FDEF', check: invalidCode },
    { name: 'room-encoded-id', route: roomPath.replace(/\/room\/(.)/, (_, first) => `/room/%${first.charCodeAt(0).toString(16)}`), check: room },
    { name: 'home-invalid-fragment', route: '/#%FF%', check: home },
    { name: 'invite-double-encoded-invalid', route: '/r/%25FF', check: invalidCode },
    { name: 'invite-long-invalid', route: `/r/${'%FF'.repeat(128)}`, check: invalidCode },
    { name: 'room-invalid-utf8', route: '/room/%FF', check: invalidLink },
    { name: 'room-encoded-slash', route: '/room/abc%2Fdef', check: invalidLink },
    { name: 'room-empty-date', route: `${roomPath}?date=`, check: invalidLink },
    { name: 'room-long-date', route: `${roomPath}?date=${'%FF'.repeat(128)}`, check: invalidLink },
    { name: 'playlist-invalid-percent', route: `${roomPath}/playlist/%`, check: invalidLink },
    { name: 'playlist-invalid-utf8', route: `${roomPath}/playlist/%FF`, check: invalidLink },
    { name: 'playlist-invalid-calendar', route: `${roomPath}/playlist/2026-02-30`, check: invalidLink },
    { name: 'playlist-encoded-date', route: `${roomPath}/playlist/2026%2D05%2D15`, check: playlist },
    { name: 'room-query-cannot-replace-id', route: `${roomPath}?id=other&id=another`, check: room },
  );
  const selected = process.env.TEST_URL_FILTER ? cases.filter(item => new RegExp(process.env.TEST_URL_FILTER).test(item.name)) : cases;
  for (const item of selected) {
    assert(item.route.length < 4096);
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    page.setDefaultNavigationTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Debugger.enable');
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    try {
      await page.goto(root + item.route, { waitUntil: 'domcontentloaded' });
      await item.check(page);
      await page.waitForFunction(() => document.body.innerText.trim().length > 10);
      if (item.pathname) assert.equal(new URL(page.url()).pathname, item.pathname);
      assert.equal(new URL(page.url()).origin, root);
      assert.deepEqual(errors, []);
      console.log(`PASS URL ${item.name}`);
    } catch (error) {
      failures.push({ name: item.name, message: error.message.split('\n')[0], errors, screen: (await page.locator('body').innerText({ timeout: 1000 })).slice(0, 500) });
      console.error(`FAIL URL ${item.name}: ${failures.at(-1).message}`, errors);
    } finally {
      await collectCoverage(cdp);
      await page.close();
    }
  }
  console.log(JSON.stringify({ cases: selected.length, decoder, nativeParser, blockedExternalOrigins: [...external], failures }, null, 2));
  assert(decoder.observations > 0, 'decoder presence was not observed in the actual bundle');
  assert.equal(decoder.calls, 0, 'vulnerable decoder executed: investigate before accepting');
  assert(nativeParser.calls > 0, 'Expo URL.searchParams parser was not observed executing');
  assert.deepEqual(failures, []);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline);
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
