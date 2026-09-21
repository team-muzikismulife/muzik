import { createRequire } from "node:module";
const { test, expect } = createRequire(
  new URL("../../../apps/web/package.json", import.meta.url),
)("@playwright/test");
test("Cloudflare 로컬 SPA 직접 진입·누락 자산 MIME 보호", async ({
  request,
}: any) => {
  for (const path of [
    "/",
    "/r/ABC234",
    "/room/00000000-0000-4000-8000-000000000001",
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
  expect(missing.headers()["content-type"]).toContain("text/html");
  expect(missing.headers()["x-content-type-options"]).toBe("nosniff");
});
test("Cloudflare 로컬 업데이트 헤더·manifest·실제 PNG 아이콘", async ({
  request,
}: any) => {
  for (const path of ["/sw.js", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-cache");
  }
  expect((await request.get("/")).headers()["cache-control"]).toContain(
    "must-revalidate",
  );
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.id).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.start_url).toBe("/");
  expect(manifest.related_applications).toContainEqual({
    platform: "webapp",
    id: "/",
    url: "/manifest.webmanifest",
  });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    const buffer = await response.body();
    expect(buffer.subarray(1, 4).toString()).toBe("PNG");
    const size = Number(icon.sizes.split("x")[0]);
    expect(buffer.readUInt32BE(16)).toBe(size);
    expect(buffer.readUInt32BE(20)).toBe(size);
  }
});
