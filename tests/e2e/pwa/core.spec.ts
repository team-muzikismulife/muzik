import { createRequire } from "node:module";
const { test, expect } = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
)("@playwright/test");
test("공개 화면·미연동·모바일 폭·manifest", async ({
  page,
}: any, testInfo: any) => {
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "MUZIK", exact: true }),
    ).toBeVisible();
    await page
      .locator("img")
      .evaluateAll(async (images: HTMLImageElement[]) => {
        await Promise.all(
          images.map((image) => image.decode().catch(() => undefined)),
        );
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`home-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "팀 만들기", exact: true }).click();
  if (process.env.PWA_TEST_BACKEND === "1")
    await expect(
      page.getByRole("button", { name: "Google로 계속하기" }),
    ).toBeVisible();
  else {
    await expect(
      page.getByRole("heading", { name: "서비스 연결 준비 중" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Google로 계속하기" }),
    ).toHaveCount(0);
  }
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.id).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBe(3);
  expect(errors).toEqual([]);
});
test("두 사용자 실제 로컬 Supabase 핵심 흐름", async ({
  browser,
}: any, testInfo: any) => {
  test.skip(
    process.env.PWA_TEST_BACKEND !== "1",
    "운영 연결 없이 공개 화면만 검사하는 job",
  );
  const { clients } = await import("../../fixtures/local-supabase.ts");
  const { settings, user } = clients();
  const [a, b] = await Promise.all([user(), user()]);
  const contexts = await Promise.all(
    [a, b].map(async (actor) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      await context.addInitScript(
        ({ key, session }: any) =>
          localStorage.setItem(key, JSON.stringify(session)),
        {
          key: `sb-${new URL(settings.API_URL).hostname.split(".")[0]}-auth-token`,
          session: actor.session,
        },
      );
      return context;
    }),
  );
  const first = await contexts[0].newPage(),
    second = await contexts[1].newPage();
  try {
    await first.goto("/room/create");
    await first.getByLabel("팀 이름", { exact: true }).fill("함께 듣는 음악");
    await first.getByLabel("이 팀에서 쓸 닉네임").fill("대표");
    await first.getByRole("button", { name: "팀 개설하기" }).click();
    await first.getByRole("button", { name: "초대하기", exact: true }).click();
    const invite = await first.evaluate(() => navigator.clipboard.readText());
    expect(invite).toMatch(/\/r\/[A-Z2-9]{6}$/);
    await first.getByRole("link", { name: "팀으로 이동" }).click();
    await first.waitForURL(/\/room\/[0-9a-f-]{36}$/);
    const room = first.url();
    await second.goto(invite);
    await expect(
      second.getByRole("heading", { name: "함께 듣는 음악" }),
    ).toBeVisible();
    await second.getByLabel("이 팀에서 쓸 닉네임").fill("참여자");
    await second.getByRole("button", { name: "입장하기" }).click();
    await expect(second).toHaveURL(room);
    await expect(
      second.getByText("팀의 최신 음악을 받고 있어요"),
    ).toBeVisible();
    await first
      .getByRole("link", { name: "오늘의 곡 추가", exact: true })
      .click();
    await first
      .getByLabel("YouTube 링크", { exact: true })
      .fill("https://youtu.be/dQw4w9WgXcQ");
    await expect(
      first.getByRole("heading", { name: "검증용 음악" }),
    ).toBeVisible();
    await first.getByLabel("추천하는 이유").fill("다 같이 듣고 싶은 곡");
    let lost = false;
    await first.route("**/functions/v1/muzik", async (route: any) => {
      const body = route.request().postDataJSON();
      if (body.action === "registerTrack" && !lost) {
        lost = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await first.getByRole("button", { name: "곡 등록하기" }).click();
    await expect(first.getByRole("alert")).toBeVisible();
    await expect(first.getByLabel("추천하는 이유")).toHaveValue(
      "다 같이 듣고 싶은 곡",
    );
    await first.getByRole("button", { name: "저장 결과 확인" }).click();
    await expect(
      first.getByText("다 같이 듣고 싶은 곡", { exact: true }),
    ).toBeVisible();
    await expect(
      second.getByText("다 같이 듣고 싶은 곡", { exact: true }),
    ).toBeVisible();
    await second.goto(invite);
    await expect(second).toHaveURL(room);
    await expect(second.getByLabel("이 팀에서 쓸 닉네임")).toHaveCount(0);
    await first.getByRole("link", { name: "내 곡 수정", exact: true }).click();
    await first.getByLabel("추천하는 이유").fill("수정한 추천 이유");
    await first.getByRole("button", { name: "수정 완료" }).click();
    await expect(
      second.getByText("수정한 추천 이유", { exact: true }),
    ).toBeVisible();
    await first.screenshot({
      path: testInfo.outputPath("room.png"),
      fullPage: true,
    });
    first.once("dialog", (dialog: any) => dialog.accept());
    await first.getByRole("button", { name: "더보기", exact: true }).click();
    await first
      .getByRole("button", { name: "내 곡 삭제", exact: true })
      .click();
    await expect(
      second.getByText("수정한 추천 이유", { exact: true }),
    ).toHaveCount(0);
    await first.getByRole("button", { name: "로그아웃" }).click();
    await expect(
      first.getByRole("heading", { name: "MUZIK", exact: true }),
    ).toBeVisible();
    expect(
      await first.evaluate(() =>
        Object.keys(localStorage).some(
          (k) => k.startsWith("muzik:") && !k.startsWith("muzik:oauth"),
        ),
      ),
    ).toBe(false);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
