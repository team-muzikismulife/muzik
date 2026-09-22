import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const clean = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith("VITE_") && !key.startsWith("VERCEL"),
  ),
);
const valid = {
  VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test_only",
  VITE_PUBLIC_ORIGIN: "https://muzik.example",
  VITE_APP_VERSION: "b32fdb0",
};
function check(env: Record<string, string>, release = true) {
  return spawnSync(
    process.execPath,
    ["scripts/check-env.mjs", ...(release ? ["--release"] : [])],
    { cwd, env: { ...clean, ...env }, encoding: "utf8" },
  );
}
function checkVercel(env: Record<string, string>) {
  return spawnSync(process.execPath, ["scripts/vercel-build.mjs", "--check-only"], {
    cwd,
    env: { ...clean, ...env },
    encoding: "utf8",
  });
}
describe("release configuration boundary", () => {
  it("allows the unconnected public build but never calls it a release", () => {
    expect(check({}, false).status).toBe(0);
    expect(check({}).status).not.toBe(0);
  });
  it("requires every public setting and commit identity", () => {
    expect(check(valid).status).toBe(0);
    for (const key of Object.keys(valid))
      expect(check({ ...valid, [key]: "" }).status).not.toBe(0);
  });
  it("rejects local backends, non-origin URLs and unversioned releases", () => {
    for (const patch of [
      { VITE_SUPABASE_URL: "http://127.0.0.1:54321" },
      { VITE_SUPABASE_URL: "https://example.com/path" },
      { VITE_PUBLIC_ORIGIN: "http://example.com" },
      { VITE_PUBLIC_ORIGIN: "https://example.com/path" },
      { VITE_APP_VERSION: "latest" },
    ])
      expect(check({ ...valid, ...patch }).status).not.toBe(0);
  });
  it("rejects client secrets even when the rest of the release is valid", () => {
    expect(
      check({ ...valid, VITE_YOUTUBE_API_KEY: "test-only" }).status,
    ).not.toBe(0);
    expect(
      check({ ...valid, VITE_SUPABASE_ANON_KEY: "sb_secret_test-only" }).status,
    ).not.toBe(0);
  });
});

describe("Vercel build boundary", () => {
  const vercel = {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
    VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: valid.VITE_SUPABASE_ANON_KEY,
    VITE_PUBLIC_ORIGIN: valid.VITE_PUBLIC_ORIGIN,
  };

  it("accepts production and preview with a fixed origin and commit identity", () => {
    expect(checkVercel(vercel).status).toBe(0);
    const preview = checkVercel({ ...vercel, VERCEL_ENV: "preview" });
    expect(preview.status).toBe(0);
    expect(preview.stdout).toContain("설치 안내와 설치 지표는 차단");
  });

  it("rejects local, development, missing commit and secret-bearing builds", () => {
    for (const patch of [
      { VERCEL: "" },
      { VERCEL_ENV: "development" },
      { VERCEL_GIT_COMMIT_SHA: "" },
      { VITE_PUBLIC_ORIGIN: "http://localhost:4173" },
      { VITE_YOUTUBE_API_KEY: "test-only" },
    ])
      expect(checkVercel({ ...vercel, ...patch }).status).not.toBe(0);
  });
});
