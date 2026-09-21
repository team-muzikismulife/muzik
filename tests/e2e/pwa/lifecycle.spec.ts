import { createRequire } from "node:module";
import { clients, invoke, requireWeb } from "../../fixtures/local-supabase.ts";
import { versionServer } from "../../fixtures/version-server.ts";
import { todayKey } from "../../../packages/domain/index.ts";
const { test, expect } = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
)("@playwright/test");
const origin = "https://127.0.0.1:4174";
test.describe("PWA 수명과 운영", () => {
  test.skip(
    process.env.PWA_TEST_BACKEND !== "1",
    "실제 로컬 Supabase/HTTPS fixture 필요",
  );
  test.setTimeout(180000);
  let server: Awaited<ReturnType<typeof versionServer>>;
  test.beforeAll(async () => {
    server = await versionServer();
  });
  test.afterAll(async () => {
    await server?.close();
  });
  async function setup(browser: any, options: any = {}) {
    server.version("a");
    const api = clients();
    const actor = await api.user();
    const room = await invoke(api.settings, actor.session, "createRoom", {
      name: "매일 돌아오는 팀",
      nickname: "사용자",
    });
    expect(room.status).toBe(200);
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      ...options,
    });
    const key = `sb-${new URL(api.settings.API_URL).hostname.split(".")[0]}-auth-token`;
    context.setDefaultTimeout(15000);
    await context.addInitScript(
      ({ key, session }: any) => {
        if (!localStorage.getItem("test-login-applied")) {
          localStorage.setItem(key, JSON.stringify(session));
          localStorage.setItem("test-login-applied", "yes");
        }
      },
      { key, session: actor.session },
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    return { ...api, actor, room: room.body, context, page, key, errors };
  }
  async function swReady(page: any) {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
  }
  test("고정 주소 설치 제안·명시 클릭·수락과 독립 실행 구분·preview 차단", async ({
    browser,
  }: any, testInfo: any) => {
    const t = await setup(browser);
    try {
      await t.page.goto(`${origin}/`);
      await t.page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await expect(
        t.page.getByRole("complementary", { name: "앱 업데이트" }),
      ).toHaveCount(0);
      await swReady(t.page);
      await expect(
        t.page.getByRole("complementary", { name: "앱 업데이트" }),
      ).toHaveCount(0);
      await t.page
        .getByRole("button", { name: "설치 안내", exact: true })
        .click();
      await expect(
        t.page.getByText(/브라우저 메뉴에서 ‘앱 설치’/),
      ).toBeVisible();
      await t.page.getByRole("button", { name: "설치 안내 닫기" }).click();
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toBeFocused();
      await t.page.evaluate(() => {
        const e = new Event("beforeinstallprompt", { cancelable: true }) as any;
        (window as any).installCalls = 0;
        e.prompt = async () => {
          (window as any).installCalls++;
        };
        e.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(e);
      });
      await expect(
        t.page.getByRole("heading", { name: "홈 화면에 MUZIK" }),
      ).toHaveCount(0);
      await t.page
        .getByRole("button", { name: "설치 안내", exact: true })
        .click();
      expect(await t.page.evaluate(() => (window as any).installCalls)).toBe(0);
      await t.page
        .getByRole("button", { name: "홈 화면에 추가", exact: true })
        .click();
      await expect(t.page.getByText(/설치 요청을 수락했어요/)).toBeVisible();
      expect(await t.page.evaluate(() => (window as any).installCalls)).toBe(1);
      const db = new (requireWeb("pg").Client)({
        connectionString: t.settings.DB_URL,
      });
      await db.connect();
      await expect
        .poll(async () =>
          Number(
            (
              await db.query(
                "select count(*) from private.daily_events where actor=$1 and kind='install_accepted'",
                [t.actor.id],
              )
            ).rows[0].count,
          ),
        )
        .toBe(1);
      expect(
        Number(
          (
            await db.query(
              "select count(*) from private.daily_events where actor=$1 and kind='standalone'",
              [t.actor.id],
            )
          ).rows[0].count,
        ),
      ).toBe(0);
      for (const kind of [
        "install_open",
        "install_request",
        "install_accepted",
      ]) {
        await expect
          .poll(async () =>
            Number(
              (
                await db.query(
                  "select count(*) from private.daily_events where actor=$1 and kind=$2",
                  [t.actor.id, kind],
                )
              ).rows[0].count,
            ),
          )
          .toBe(1);
      }
      await db.end();
      await t.page.evaluate(() =>
        window.dispatchEvent(new Event("appinstalled")),
      );
      await expect(
        t.page.getByRole("heading", { name: "홈 화면에 MUZIK" }),
      ).toHaveCount(0);
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toHaveCount(0);
      await t.page.reload();
      await expect(
        t.page.getByRole("heading", { name: "내 팀", exact: true }),
      ).toBeVisible();
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toHaveCount(0);
      await t.page.goto("http://127.0.0.1:4173/");
      await t.page
        .getByRole("button", { name: "설치 안내", exact: true })
        .click();
      await expect(
        t.page.getByText(/이 미리보기에서는 설치하지 마세요/),
      ).toBeVisible();
      await t.page.screenshot({
        path: testInfo.outputPath("install-preview-390.png"),
        fullPage: true,
      });
    } finally {
      await t.context.close();
    }
  });
  test("지원 브라우저 관련 앱 확인·다른 앱 제외·재설치 가능 신호", async ({
    browser,
  }: any) => {
    const t = await setup(browser);
    try {
      await t.context.addInitScript(() => {
        Object.defineProperty(navigator, "getInstalledRelatedApps", {
          configurable: true,
          value: async () => [
            {
              platform: "webapp",
              id:
                localStorage.getItem("test-related-id") ||
                "https://another.example/",
            },
          ],
        });
      });
      await t.page.goto(`${origin}/`);
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toBeVisible();
      await t.page.evaluate(() =>
        localStorage.setItem("test-related-id", `${location.origin}/`),
      );
      await t.page.reload();
      await expect(
        t.page.getByRole("heading", { name: "내 팀", exact: true }),
      ).toBeVisible();
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toHaveCount(0);
      await t.page.evaluate(() => {
        localStorage.removeItem("test-related-id");
        window.dispatchEvent(
          new Event("beforeinstallprompt", { cancelable: true }),
        );
      });
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toBeVisible();
      await t.page.reload();
      await expect(
        t.page.getByRole("button", { name: "설치 안내", exact: true }),
      ).toBeVisible();
    } finally {
      await t.context.close();
    }
  });
  for (const width of [360, 390])
    test(`첫 서버 등록 뒤 안내 viewport·자동 노출 미집계·닫기·iPhone/인앱/이미설치 ${width}`, async ({
      browser,
    }: any, testInfo: any) => {
      const t = await setup(browser, {
        viewport: { width, height: 844 },
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      });
      try {
        await t.page.goto(
          `${origin}/room/${t.room.roomId}/track/new?date=${todayKey()}`,
        );
        await t.page
          .getByLabel("YouTube 링크", { exact: true })
          .fill("https://youtu.be/dQw4w9WgXcQ");
        await t.page
          .getByRole("button", { name: "곡 등록하기", exact: true })
          .click();
        await expect(
          t.page.getByRole("heading", { name: "홈 화면에 MUZIK" }),
        ).toBeVisible();
        await expect(t.page.getByText(/Safari의 공유 버튼/)).toBeVisible();
        await expect(t.page).toHaveURL(
          new RegExp(`/room/${t.room.roomId}\\?date=`),
        );
        const close = t.page.getByRole("button", { name: "설치 안내 닫기" });
        await expect(close).toBeInViewport();
        await expect(
          t.page.getByRole("heading", { name: "홈 화면에 MUZIK" }),
        ).toBeInViewport();
        expect(
          await close.evaluate((el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return (
              r.width >= 44 &&
              r.height >= 44 &&
              el.contains(
                document.elementFromPoint(
                  r.left + r.width / 2,
                  r.top + r.height / 2,
                ),
              )
            );
          }),
        ).toBe(true);
        const autoDb = new (requireWeb("pg").Client)({
          connectionString: t.settings.DB_URL,
        });
        await autoDb.connect();
        expect(
          Number(
            (
              await autoDb.query(
                "select count(*) from private.daily_events where actor=$1 and kind like 'install_%'",
                [t.actor.id],
              )
            ).rows[0].count,
          ),
        ).toBe(0);
        await autoDb.end();
        await t.page.screenshot({
          path: testInfo.outputPath(`install-ios-viewport-${width}.png`),
          fullPage: false,
        });
        await t.page.getByRole("button", { name: "설치 안내 닫기" }).click();
        await t.page.reload();
        await expect(
          t.page.getByRole("heading", { name: "홈 화면에 MUZIK" }),
        ).toHaveCount(0);
        await t.page.goto(`${origin}/`);
        await t.page
          .getByRole("button", { name: "설치 안내", exact: true })
          .click();
        await expect(t.page.getByText(/Safari의 공유 버튼/)).toBeVisible();
        const embedded = await setup(browser, {
          userAgent: "Mozilla/5.0 iPhone Safari KAKAOTALK",
        });
        await embedded.page.goto(`${origin}/`);
        await embedded.page
          .getByRole("button", { name: "설치 안내", exact: true })
          .click();
        await expect(
          embedded.page.getByRole("button", { name: "링크 복사", exact: true }),
        ).toBeVisible();
        await embedded.context.close();
        const installed = await setup(browser);
        await installed.context.addInitScript(() => {
          const original = window.matchMedia;
          window.matchMedia = (query: string) =>
            query === "(display-mode: standalone)"
              ? ({
                  ...original.call(window, query),
                  matches: true,
                  addEventListener: () => {},
                  removeEventListener: () => {},
                } as MediaQueryList)
              : original.call(window, query);
        });
        await installed.page.goto(`${origin}/`);
        await expect(
          installed.page.getByRole("heading", { name: "내 팀", exact: true }),
        ).toBeVisible();
        await expect(
          installed.page.getByRole("button", {
            name: "설치 안내",
            exact: true,
          }),
        ).toHaveCount(0);
        const metricsDb = new (requireWeb("pg").Client)({
          connectionString: installed.settings.DB_URL,
        });
        await metricsDb.connect();
        await expect
          .poll(async () =>
            Number(
              (
                await metricsDb.query(
                  "select count(*) from private.daily_events where actor=$1 and kind='standalone'",
                  [installed.actor.id],
                )
              ).rows[0].count,
            ),
          )
          .toBe(1);
        await metricsDb.end();
        await installed.context.close();
      } finally {
        await t.context.close();
      }
    });
  test("오프라인 cold reopen·초안 편집·온라인 명시 저장·만료 계정 복구", async ({
    browser,
  }: any) => {
    const t = await setup(browser);
    try {
      const url = `${origin}/room/${t.room.roomId}/track/new?date=${todayKey()}`;
      await t.page.goto(url);
      await t.page.getByLabel("추천하는 이유").fill("오프라인에 남길 초안");
      await swReady(t.page);
      await t.context.setOffline(true);
      await t.page.close();
      const page = await t.context.newPage();
      await page.goto(url);
      await expect(page.getByLabel("추천하는 이유")).toHaveValue(
        "오프라인에 남길 초안",
      );
      await expect(
        page.getByText(/팀 권한과 저장 결과는 아직 확인하지 않았어요/),
      ).toBeVisible();
      await page.getByLabel("추천하는 이유").fill("다시 열어서 고친 초안");
      await page
        .getByLabel("YouTube 링크", { exact: true })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await expect(
        page.getByRole("button", { name: "곡 등록하기", exact: true }),
      ).toBeDisabled();
      await t.context.setOffline(false);
      await expect(
        page.getByRole("button", { name: "곡 등록하기", exact: true }),
      ).toBeEnabled();
      expect(
        (
          await t.actor.client
            .from("tracks")
            .select("id")
            .eq("room_id", t.room.roomId)
        ).data,
      ).toEqual([]);
      await t.context.setOffline(true);
      await page.evaluate((key: string) => {
        const s = JSON.parse(localStorage.getItem(key)!);
        s.expires_at = 1;
        s.refresh_token = "expired-fixture";
        localStorage.setItem(key, JSON.stringify(s));
      }, t.key);
      await page.reload();
      await expect(page.getByLabel("추천하는 이유")).toHaveValue(
        "다시 열어서 고친 초안",
      );
      await expect(
        page.getByRole("link", { name: "같은 계정으로 로그인하고 복구" }),
      ).toBeVisible();
      await page.goto(origin);
      await expect(
        page.getByRole("heading", { name: "이 기기에 보관한 내 초안" }),
      ).toBeVisible();
    } finally {
      await t.context.close();
    }
  });
  test("실제 worker 대기·저장 중 갱신 차단·미확정 요청 복구·캐시 정리·버전 롤백", async ({
    browser,
  }: any, testInfo: any) => {
    const t = await setup(browser);
    try {
      const url = `${origin}/room/${t.room.roomId}/track/new?date=${todayKey()}`;
      await t.page.goto(url);
      await swReady(t.page);
      await t.page
        .getByLabel("YouTube 링크", { exact: true })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await t.page
        .getByLabel("추천하는 이유")
        .fill("업데이트 뒤에도 남는 요청");
      const oldAssets = await t.page.evaluate(async () => {
        const names = await caches.keys();
        return (
          await Promise.all(
            names.map(async (n) =>
              (await (await caches.open(n)).keys()).map((r) => r.url),
            ),
          )
        )
          .flat()
          .filter((u) => /\/assets\/index-.*\.js/.test(u));
      });
      let release: () => void = () => {};
      let requestId = "";
      await t.page.route("**/functions/v1/muzik", async (route: any) => {
        const body = route.request().postDataJSON();
        if (body.action === "registerTrack") {
          requestId = body.requestId;
          await route.fetch();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          await route.abort();
        } else await route.continue();
      });
      await t.page
        .getByRole("button", { name: "곡 등록하기", exact: true })
        .click();
      await expect.poll(() => requestId).not.toBe("");
      server.version("b");
      await t.page.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())?.update();
      });
      const update = t.page.getByRole("button", {
        name: "업데이트",
        exact: true,
      });
      await expect(update).toBeDisabled();
      await expect(t.page.locator("[data-app-version]")).toHaveAttribute(
        "data-app-version",
        "a",
      );
      await t.page.getByRole("button", { name: "나중에", exact: true }).click();
      release();
      await expect(
        t.page.getByRole("button", { name: "저장 결과 확인", exact: true }),
      ).toBeEnabled();
      await t.page.getByRole("button", { name: "업데이트 안내 열기" }).click();
      await expect(update).toBeEnabled();
      await t.page.screenshot({
        path: testInfo.outputPath("update-draft-390.png"),
        fullPage: true,
      });
      t.page.once("dialog", (d: any) => d.accept());
      await update.click();
      await expect(t.page.locator("[data-app-version]")).toHaveAttribute(
        "data-app-version",
        "b",
      );
      await expect(t.page.getByLabel("추천하는 이유")).toHaveValue(
        "업데이트 뒤에도 남는 요청",
      );
      await t.context.setOffline(true);
      await t.page.reload();
      await expect(t.page.getByLabel("추천하는 이유")).toHaveValue(
        "업데이트 뒤에도 남는 요청",
      );
      await expect(
        t.page.getByRole("button", { name: "저장 결과 확인", exact: true }),
      ).toBeDisabled();
      const savedRequest = await t.page.evaluate(
        () =>
          Object.entries(localStorage)
            .filter(([k]) => k.includes(":draft:"))
            .map(([, v]) => JSON.parse(v))[0]?.intent?.id,
      );
      expect(savedRequest).toBe(requestId);
      await t.context.setOffline(false);
      await t.page.unroute("**/functions/v1/muzik");
      let replay = "";
      await t.page.route("**/functions/v1/muzik", async (route: any) => {
        const b = route.request().postDataJSON();
        if (b.action === "registerTrack") replay = b.requestId;
        await route.continue();
      });
      await t.page
        .getByRole("button", { name: "저장 결과 확인", exact: true })
        .click();
      await expect(t.page.getByRole("article")).toHaveCount(1);
      expect(replay).toBe(requestId);
      const currentAssets = await t.page.evaluate(async () => {
        const names = await caches.keys();
        return (
          await Promise.all(
            names.map(async (n) =>
              (await (await caches.open(n)).keys()).map((r) => r.url),
            ),
          )
        ).flat();
      });
      expect(oldAssets.length).toBeGreaterThan(0);
      expect(currentAssets.length).toBeGreaterThan(0);
      expect(oldAssets.every((u: string) => !currentAssets.includes(u))).toBe(
        true,
      );
      expect(
        currentAssets.every(
          (u: string) =>
            u.startsWith(origin) &&
            !u.includes("/auth/") &&
            !u.includes("/rest/") &&
            !u.includes("/functions/"),
        ),
      ).toBe(true);
      server.version("a");
      await t.page.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())?.update();
      });
      await expect(update).toBeEnabled();
      t.page.once("dialog", (d: any) => d.accept());
      await update.click();
      await expect(t.page.locator("[data-app-version]")).toHaveAttribute(
        "data-app-version",
        "a",
      );
    } finally {
      await t.context.close();
      server.version("a");
    }
  });
  test("피드백 응답 유실 재실행·일반 사용자 운영 차단·운영 처리", async ({
    browser,
  }: any, testInfo: any) => {
    const t = await setup(browser);
    const db = new (requireWeb("pg").Client)({
      connectionString: t.settings.DB_URL,
    });
    await db.connect();
    const message = `실제 사용자 흐름 의견 ${"longtext".repeat(100)}`;
    try {
      await t.page.goto(`${origin}/room/${t.room.roomId}/feedback`);
      await t.page.getByLabel("의견", { exact: true }).fill(message);
      await t.page.setViewportSize({ width: 360, height: 420 });
      const submit = t.page.getByRole("button", {
        name: "의견 보내기",
        exact: true,
      });
      await submit.scrollIntoViewIfNeeded();
      expect(
        await submit.evaluate((el: HTMLElement) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2,
            ),
          );
        }),
      ).toBe(true);
      await t.page.screenshot({
        path: testInfo.outputPath("feedback-keyboard-360.png"),
        fullPage: true,
      });
      await t.page.route("**/functions/v1/muzik", async (route: any) => {
        if (route.request().postDataJSON().action === "sendFeedback") {
          await route.fetch();
          await route.abort();
        } else await route.continue();
      });
      await t.page
        .getByRole("button", { name: "의견 보내기", exact: true })
        .click();
      await expect(t.page.getByRole("alert")).toBeVisible();
      await t.page.unroute("**/functions/v1/muzik");
      await t.page.reload();
      await expect(t.page.getByLabel("의견", { exact: true })).toHaveValue(
        message,
      );
      await t.page.getByRole("button", { name: "전송 결과 확인" }).click();
      await expect(
        t.page.getByText("의견을 받았어요. 고맙습니다."),
      ).toBeVisible();
      expect(
        Number(
          (
            await db.query(
              "select count(*) from private.feedback where actor=$1",
              [t.actor.id],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      const reporter = await t.user();
      expect(
        (
          await invoke(t.settings, reporter.session, "joinRoom", {
            code: t.room.code,
            nickname: "신고자",
          })
        ).status,
      ).toBe(200);
      const track = await invoke(t.settings, t.actor.session, "registerTrack", {
        roomId: t.room.roomId,
        dateKey: todayKey(),
        videoId: "dQw4w9WgXcQ",
        comment: "운영 UI 확인 원문",
      });
      expect(track.status).toBe(200);
      expect(
        (
          await invoke(t.settings, reporter.session, "reportTrack", {
            roomId: t.room.roomId,
            trackId: track.body.trackId,
            reason: "운영 화면에서 검토할 신고",
          })
        ).status,
      ).toBe(200);
      await t.page.goto(`${origin}/operations`);
      await expect(
        t.page.getByRole("heading", { name: "운영 권한이 없어요" }),
      ).toBeVisible();
      await expect(
        t.page.getByRole("heading", { name: "사용자 의견" }),
      ).toHaveCount(0);
      await db.query("insert into private.operators values($1)", [t.actor.id]);
      await t.page.reload();
      await expect(
        t.page.getByRole("heading", { name: "운영 검토", exact: true }),
      ).toBeVisible();
      const reported = t.page
        .getByRole("article")
        .filter({ hasText: "운영 화면에서 검토할 신고" });
      await reported.getByLabel("처리 메모").fill("확인 후 공개에서 제외");
      await t.page.setViewportSize({ width: 390, height: 844 });
      await t.page.screenshot({
        path: testInfo.outputPath("operations-report-390.png"),
        fullPage: true,
      });
      t.page.once("dialog", (d: any) => d.accept());
      await reported.getByRole("button", { name: "곡 숨기기" }).click();
      await expect(reported).toHaveCount(0);
      const hidden = (
        await t.actor.client
          .from("tracks")
          .select("hidden,comment")
          .eq("id", track.body.trackId)
          .single()
      ).data;
      expect(hidden).toEqual({ hidden: true, comment: "" });
      const article = t.page
        .getByRole("article")
        .filter({ hasText: "실제 사용자 흐름 의견" });
      await article.getByLabel("처리 메모").fill("확인했어요");
      await article.getByRole("button", { name: "검토 완료" }).click();
      await expect(article).toHaveCount(0);
      await t.page.setViewportSize({ width: 360, height: 844 });
      expect(
        await t.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await t.page.screenshot({
        path: testInfo.outputPath("operations-360.png"),
        fullPage: true,
      });
      await t.page.evaluate(() => {
        const nodes = [
          ...document.querySelectorAll<HTMLElement>("main *,header *"),
        ];
        const sizes = nodes.map((el) => getComputedStyle(el).fontSize);
        nodes.forEach(
          (el, i) => (el.style.fontSize = `${parseFloat(sizes[i]) * 2}px`),
        );
      });
      expect(
        await t.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await t.page.screenshot({
        path: testInfo.outputPath("operations-360-text200.png"),
        fullPage: true,
      });
    } finally {
      await db.end();
      await t.context.close();
    }
  });
});
