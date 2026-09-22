import { createRequire } from "node:module";
const { test, expect } = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
)("@playwright/test");
test("Vercel 정적 계약의 SPA 직접 진입과 누락 자산 보호", async ({
  request,
}: any) => {
  for (const path of [
    "/",
    "/login",
    "/operations",
    "/r/ABC234",
    "/room/00000000-0000-4000-8000-000000000001",
    "/room/00000000-0000-4000-8000-000000000001/playlist/2026-09-22",
    "/room/00000000-0000-4000-8000-000000000001/track/new?date=2026-09-22",
    "/auth/callback?code=test-only",
  ]) {
    const response = await request.get(path, {
      headers: { "Sec-Fetch-Mode": "navigate" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(await response.text()).toContain('id="root"');
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  }
  const missing = await request.get("/assets/nonexistent-file.js");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["content-type"]).toContain("text/plain");
  expect(missing.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await missing.text()).not.toContain('id="root"');
});
test("Vercel 정적 계약의 캐시·MIME·실제 PWA 아이콘", async ({
  request,
}: any) => {
  for (const path of ["/sw.js", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("must-revalidate");
  }
  const index = await request.get("/");
  expect(index.headers()["cache-control"]).toContain("must-revalidate");
  const html = await index.text();
  const asset = html.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)?.[1];
  expect(asset).toBeTruthy();
  const hashed = await request.get(asset!);
  expect(hashed.status()).toBe(200);
  expect(hashed.headers()["cache-control"]).toContain("immutable");
  expect(hashed.headers()["content-type"]).toMatch(/javascript|text\/css/);

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.id).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toBe("/");
  expect(manifest.related_applications).toContainEqual({
    platform: "webapp",
    id: "/",
    url: "/manifest.webmanifest",
  });
  expect(manifest.icons).toContainEqual(
    expect.objectContaining({
      src: "/icons/maskable-512.png",
      purpose: "maskable",
    }),
  );
  const apple = html.match(
    /<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/,
  )?.[1];
  expect(apple).toBe("/icons/apple-touch-icon.png");
  for (const icon of [
    ...manifest.icons,
    { src: apple, sizes: "180x180" },
  ]) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    const buffer = await response.body();
    expect(buffer.subarray(1, 4).toString()).toBe("PNG");
    const size = Number(icon.sizes.split("x")[0]);
    expect(buffer.readUInt32BE(16)).toBe(size);
    expect(buffer.readUInt32BE(20)).toBe(size);
  }
});
