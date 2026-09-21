import { createRequire } from "node:module";
import { clients, invoke } from "../../fixtures/local-supabase.ts";
import { todayKey } from "../../../packages/domain/index.ts";
import { youtubePlayerScript } from "../../fixtures/youtube-player.ts";
const { test, expect } = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
)("@playwright/test");
test.describe("일상 사용 경계", () => {
  test.skip(
    process.env.PWA_TEST_BACKEND !== "1",
    "로컬 Supabase CI에서만 실행",
  );
  test.setTimeout(120000);
  async function setup(browser: any) {
    const api = clients();
    const [a, b] = await Promise.all([api.user(), api.user()]);
    const call = async (
      actor: any,
      action: string,
      payload: Record<string, unknown>,
    ) => {
      const r = await invoke(api.settings, actor.session, action, payload);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      return r.body;
    };
    const room = await call(a, "createRoom", {
      name: "매일 듣는 음악",
      nickname: "첫번째",
    });
    await call(b, "joinRoom", { code: room.code, nickname: "두번째" });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const key = `sb-${new URL(api.settings.API_URL).hostname.split(".")[0]}-auth-token`;
    await context.addInitScript(
      ({ key, session }: any) => {
        if (!sessionStorage.getItem("test-auth-initialized")) {
          localStorage.setItem(key, JSON.stringify(session));
          sessionStorage.setItem("test-auth-initialized", "1");
        }
      },
      { key, session: a.session },
    );
    await context.route("https://www.youtube.com/iframe_api", (route: any) =>
      route.fulfill({
        contentType: "application/javascript",
        body: youtubePlayerScript,
      }),
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    const date = todayKey();
    const register = (actor: any, comment: string) =>
      call(actor, "registerTrack", {
        roomId: room.roomId,
        dateKey: date,
        videoId: "dQw4w9WgXcQ",
        comment,
      });
    return {
      ...api,
      a,
      b,
      room,
      context,
      page,
      key,
      call,
      date,
      register,
      errors,
    };
  }
  test("미리보기 응답 역전·gateway401·응답 유실 후 새로고침 복구", async ({
    browser,
  }: any) => {
    const t = await setup(browser);
    const { page, context, room, date } = t;
    try {
      let release: () => void = () => {};
      let requested = false;
      await page.route("**/functions/v1/muzik", async (route: any) => {
        const body = route.request().postDataJSON();
        if (
          body.action === "previewTrack" &&
          body.payload.videoId === "dQw4w9WgXcQ"
        ) {
          const response = await route.fetch();
          requested = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          await route.fulfill({ response });
        } else await route.continue();
      });
      await page.goto(`/room/${room.roomId}/track/new?date=${date}`);
      await page
        .getByLabel("YouTube 링크", { exact: true })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await expect.poll(() => requested).toBe(true);
      await page
        .getByLabel("YouTube 링크", { exact: true })
        .fill("https://youtu.be/kJQP7kiw5Fk");
      await expect(page.locator("form img")).toHaveAttribute(
        "src",
        /kJQP7kiw5Fk/,
      );
      release();
      await page.waitForTimeout(150);
      await expect(page.locator("form img")).toHaveAttribute(
        "src",
        /kJQP7kiw5Fk/,
      );
      await page.unroute("**/functions/v1/muzik");
      await page.getByLabel("추천하는 이유").fill("입력과 요청을 보존해요");
      await page.route("**/functions/v1/muzik", async (route: any) => {
        if (route.request().postDataJSON().action === "registerTrack")
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ code: 401, message: "Invalid JWT" }),
          });
        else await route.continue();
      });
      await page
        .getByRole("button", { name: "곡 등록하기", exact: true })
        .click();
      await expect(
        page.getByRole("link", { name: "초안 보관하고 다시 로그인" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "초안 보관하고 다시 로그인" }),
      ).toHaveAttribute("href", /reauth=1/);
      await expect(page.getByLabel("추천하는 이유")).toHaveValue(
        "입력과 요청을 보존해요",
      );
      await page.unroute("**/functions/v1/muzik");
      let firstId = "";
      await page.route("**/functions/v1/muzik", async (route: any) => {
        const body = route.request().postDataJSON();
        if (body.action === "registerTrack") {
          firstId = body.requestId;
          await route.fetch();
          await route.abort();
        } else await route.continue();
      });
      await page.reload();
      await page
        .getByRole("button", { name: "저장 결과 확인", exact: true })
        .click();
      await expect(page.getByRole("alert")).toBeVisible();
      await page.unroute("**/functions/v1/muzik");
      let replayId = "";
      await page.route("**/functions/v1/muzik", async (route: any) => {
        const body = route.request().postDataJSON();
        if (body.action === "registerTrack") replayId = body.requestId;
        await route.continue();
      });
      await page.reload();
      await page
        .getByRole("button", { name: "저장 결과 확인", exact: true })
        .click();
      await expect(
        page.getByText("입력과 요청을 보존해요", { exact: true }),
      ).toBeVisible();
      expect(replayId).toBe(firstId);
      expect(
        (
          await t.a.client
            .from("tracks")
            .select("id")
            .eq("room_id", room.roomId)
        ).data.length,
      ).toBe(1);
      expect(t.errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
  test("편집 중 KST 자정·오프라인 초안·신규 자동 전환 금지", async ({
    browser,
  }: any) => {
    const t = await setup(browser);
    try {
      const track = await t.register(t.a, "원래 내용");
      await t.page.clock.install({ time: new Date(`${t.date}T14:59:55Z`) });
      await t.page.goto(
        `/room/${t.room.roomId}/track/edit?date=${t.date}&track=${track.trackId}`,
      );
      await t.page
        .getByLabel("추천하는 이유")
        .fill("자정에도 보관할 수정 내용");
      let saves = 0;
      t.page.on("request", (r: any) => {
        if (
          r.url().endsWith("/muzik") &&
          ["registerTrack", "updateTrack"].includes(r.postDataJSON()?.action)
        )
          saves++;
      });
      await t.page.clock.fastForward(10000);
      await expect(
        t.page.getByText(/지난 날짜의 곡은 변경할 수 없어요/),
      ).toBeVisible();
      await expect(
        t.page.getByRole("button", { name: "수정 완료" }),
      ).toBeDisabled();
      await expect(
        t.page.getByRole("button", { name: "오늘의 초안으로 가져오기" }),
      ).toHaveCount(0);
      await expect(t.page.getByLabel("추천하는 이유")).toHaveValue(
        "자정에도 보관할 수정 내용",
      );
      await t.context.setOffline(true);
      await t.page.getByLabel("추천하는 이유").fill("오프라인 수정 초안");
      await expect(t.page.getByText(/자동으로 등록하지 않아요/)).toBeVisible();
      await t.context.setOffline(false);
      await t.page.waitForTimeout(100);
      expect(saves).toBe(0);
      const drafts = await t.page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.includes(":draft:"))
          .map(([, value]) => JSON.parse(value)),
      );
      expect(drafts[0].mode).toBe("edit");
      expect(drafts[0].dateKey).toBe(t.date);
      expect(drafts[0].trackId).toBe(track.trackId);
      expect(drafts[0].comment).toBe("오프라인 수정 초안");
    } finally {
      await t.context.close();
    }
  });
  test("추천 ID 재생·마지막 종료·연속 오류·실시간 삭제·숨김 복원", async ({
    browser,
  }: any, testInfo: any) => {
    const t = await setup(browser);
    try {
      const first = await t.register(t.a, "첫 추천");
      const second = await t.register(t.b, "같은 영상 다른 추천");
      await t.page.goto(
        `/room/${t.room.roomId}/playlist/${t.date}?track=${first.trackId}`,
      );
      const player = t.page.getByRole("region", {
        name: "모아듣기",
        exact: true,
      });
      await expect(player.getByRole("status").first()).toHaveText("재생 중");
      await t.page.evaluate(() => (window as any).__ytFixture.emit(0));
      await expect(
        player.getByText("두번째님의 추천", { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => t.page.evaluate(() => (window as any).__ytCreated.length))
        .toBe(2);
      await t.page.evaluate(() => (window as any).__ytFixture.emit(0));
      await expect(
        player.getByText("모두 들었어요", { exact: true }),
      ).toBeVisible();
      await player
        .getByRole("button", { name: "다시 듣기", exact: true })
        .click();
      await expect(
        player.getByText("첫번째님의 추천", { exact: true }),
      ).toBeVisible();
      await t.page.evaluate(() => (window as any).__ytFixture.fail());
      await expect(
        player.getByText("두번째님의 추천", { exact: true }),
      ).toBeVisible();
      await expect(player.getByRole("status").first()).toHaveText("재생 중");
      await t.page.evaluate(() => (window as any).__ytFixture.fail());
      await expect(
        player.getByText(" 더 이상 재생할 수 있는 곡이 없어요.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        player.getByRole("button", { name: "다시 듣기" }),
      ).toBeVisible();
      await player.getByRole("button", { name: "다시 듣기" }).click();
      await expect(player.getByRole("status").first()).toHaveText("재생 중");
      await t.call(t.a, "deleteTrack", {
        roomId: t.room.roomId,
        dateKey: t.date,
        trackId: first.trackId,
      });
      await expect(
        player.getByText("두번째님의 추천", { exact: true }),
      ).toBeVisible();
      const card = t.page.getByRole("article", {
        name: "두번째님의 추천",
        exact: true,
      });
      await card.getByRole("button", { name: "더보기", exact: true }).click();
      await card.getByRole("button", { name: "나에게 숨기기" }).click();
      await expect(
        t.page.getByText("모든 곡을 숨겼어요", { exact: true }),
      ).toBeVisible();
      await t.page
        .getByRole("button", { name: "되돌리기", exact: true })
        .click();
      await expect(card).toBeVisible();
      await t.page.screenshot({
        path: testInfo.outputPath("daily-player-390.png"),
        fullPage: true,
      });
      expect(t.errors).toEqual([]);
    } finally {
      await t.context.close();
    }
  });
  test("14일 이후 기록·스크롤 복귀·닉네임 범위·최근 팀·로그아웃 계정 분리", async ({
    browser,
  }: any) => {
    const t = await setup(browser);
    try {
      const dates = Array.from({ length: 18 }, (_, i) => {
        const d = new Date(`${t.date}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i - 1);
        return d.toISOString().slice(0, 10);
      });
      const tracks = dates.map((date) => ({
        room_id: t.room.roomId,
        user_id: t.a.id,
        date_key: date,
        video_id: "dQw4w9WgXcQ",
        title: `지난 기록 ${date}`,
        artist: "기록 채널",
        comment: "지난 추천 이유",
        duration_sec: 180,
      }));
      expect((await t.admin.from("tracks").insert(tracks)).error).toBeNull();
      expect(
        (
          await t.admin
            .from("days")
            .insert(
              dates.map((date) => ({
                room_id: t.room.roomId,
                date_key: date,
                theme_text: "지난날의 추천",
                track_count: 1,
                cover_video_id: "dQw4w9WgXcQ",
              })),
            )
        ).error,
      ).toBeNull();
      const other = await t.call(t.a, "createRoom", {
        name: "다른 팀",
        nickname: "다른이름",
      });
      await t.page.goto(`/room/${t.room.roomId}`);
      await t.page
        .getByRole("button", { name: "팀 관리", exact: true })
        .click();
      await t.page
        .getByRole("button", { name: "내 닉네임 변경", exact: true })
        .click();
      await t.page.getByLabel("이 팀에서 쓸 닉네임").fill("바뀐이름");
      await t.page.getByRole("button", { name: "닉네임 저장" }).click();
      await expect(
        t.page.getByText("이 팀의 닉네임을 변경했어요."),
      ).toBeVisible();
      expect(
        (
          await t.a.client
            .from("members")
            .select("nickname")
            .eq("room_id", other.roomId)
            .eq("user_id", t.a.id)
            .single()
        ).data.nickname,
      ).toBe("다른이름");
      await t.page
        .getByRole("link", { name: "지난 기록", exact: true })
        .click();
      await expect(
        t.page.getByRole("heading", { name: dates[13], exact: true }),
      ).toBeVisible();
      await expect(
        t.page.getByRole("heading", { name: dates[14], exact: true }),
      ).toHaveCount(0);
      await t.page.getByRole("button", { name: "이전 기록 더 보기" }).click();
      await expect(
        t.page.getByRole("heading", { name: dates[17], exact: true }),
      ).toBeVisible();
      const last = t.page
        .getByRole("link")
        .filter({
          has: t.page.getByRole("heading", { name: dates[17], exact: true }),
        });
      await last.scrollIntoViewIfNeeded();
      const scroll = await t.page.evaluate(() => scrollY);
      await last.click();
      await expect(
        t.page.getByRole("article", { name: "바뀐이름님의 추천", exact: true }),
      ).toBeVisible();
      await t.page
        .getByRole("button", { name: "기록 목록으로 돌아가기" })
        .click();
      await expect
        .poll(() => t.page.evaluate(() => scrollY))
        .toBeGreaterThan(scroll - 80);
      await t.page.getByRole("link", { name: "MUZIK 홈", exact: true }).click();
      await expect(
        t.page.getByText("아직 등록 전", { exact: false }).first(),
      ).toBeVisible();
      const firstTeam = t.page
        .locator('main a[href^="/room/"]')
        .filter({ has: t.page.getByRole("heading") })
        .first();
      await expect(firstTeam).toContainText("매일 듣는 음악");
      await t.page.goto(`/room/${t.room.roomId}/track/new?date=${t.date}`);
      await t.page.getByLabel("추천하는 이유").fill("이 계정만의 초안");
      await t.page.evaluate(
        ({ uid, room }: any) =>
          localStorage.setItem(
            `muzik:${uid}:hidden:${room}`,
            JSON.stringify([crypto.randomUUID()]),
          ),
        { uid: t.a.id, room: t.room.roomId },
      );
      await t.page
        .getByRole("button", { name: "로그아웃", exact: true })
        .click();
      await expect(
        t.page.getByRole("heading", { name: "MUZIK", exact: true }),
      ).toBeVisible();
      expect(
        await t.page.evaluate(
          (uid: string) =>
            Object.keys(localStorage).some((k) =>
              k.startsWith(`muzik:${uid}:`),
            ),
          t.a.id,
        ),
      ).toBe(false);
      await t.page.evaluate(
        ({ key, session }: any) =>
          localStorage.setItem(key, JSON.stringify(session)),
        { key: t.key, session: t.b.session },
      );
      await t.page.goto(`/room/${t.room.roomId}/track/new?date=${t.date}`);
      await expect(t.page.getByLabel("추천하는 이유")).toHaveValue("");
      expect(t.errors).toEqual([]);
    } finally {
      await t.context.close();
    }
  });
  test("신고 접수·숨김 관리·메뉴 초점·긴 제목과 큰 글자·키보드 공간", async ({
    browser,
  }: any, testInfo: any) => {
    const t = await setup(browser);
    try {
      await t.register(t.a, "내 추천");
      const record = await t.register(t.b, "다른 추천 이유");
      await t.admin
        .from("tracks")
        .update({ title: "아주 긴 제목과 함께 듣고 싶은 음악 ".repeat(6) })
        .eq("id", record.trackId);
      await t.page.goto(`/room/${t.room.roomId}`);
      const card = t.page.getByRole("article", {
        name: "두번째님의 추천",
        exact: true,
      });
      const more = card.getByRole("button", { name: "더보기", exact: true });
      await more.click();
      await t.page.keyboard.press("Escape");
      await expect(more).toBeFocused();
      await more.click();
      await card.getByRole("button", { name: "신고하기", exact: true }).click();
      await card.getByLabel("신고 이유").fill("검토가 필요한 내용");
      await card
        .getByRole("button", { name: "신고 접수", exact: true })
        .click();
      await expect(card.getByText("신고가 접수됐어요.")).toBeVisible();
      await more.click();
      await card.getByRole("button", { name: "나에게 숨기기" }).click();
      await expect(card).toHaveCount(0);
      await t.page
        .getByRole("button", { name: "팀 관리", exact: true })
        .click();
      await t.page.getByRole("button", { name: /숨긴 곡 복원/ }).click();
      await expect(card).toBeVisible();
      for (const width of [360, 390]) {
        await t.page.setViewportSize({ width, height: 844 });
        expect(
          await t.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await t.page.screenshot({
          path: testInfo.outputPath(`daily-room-${width}.png`),
          fullPage: true,
        });
      }
      await t.page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>(
          "main *,header *",
        )) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          el.dataset.oldFont = String(size);
        }
        for (const el of document.querySelectorAll<HTMLElement>(
          "[data-old-font]",
        ))
          el.style.fontSize = `${Number(el.dataset.oldFont) * 2}px`;
      });
      expect(
        await t.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await t.page.screenshot({
        path: testInfo.outputPath("daily-room-390-text200.png"),
        fullPage: true,
      });
      await t.page.reload();
      await t.page
        .getByRole("link", { name: "내 곡 수정", exact: true })
        .click();
      await t.page.setViewportSize({ width: 360, height: 420 });
      const input = t.page.getByLabel("추천하는 이유");
      await input.fill("작은 화면에서도 입력해요");
      await input.scrollIntoViewIfNeeded();
      await expect(input).toBeVisible();
      const save = t.page.getByRole("button", {
        name: "수정 완료",
        exact: true,
      });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeVisible();
      expect(
        await save.evaluate((el: HTMLElement) => {
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
        path: testInfo.outputPath("daily-editor-keyboard-space.png"),
        fullPage: true,
      });
      expect(t.errors).toEqual([]);
    } finally {
      await t.context.close();
    }
  });
});
