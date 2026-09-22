import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
import { validateEnv } from "./check-env.mjs";

const target = process.env.VERCEL_ENV;
if (!process.env.VERCEL || !["production", "preview"].includes(target || ""))
  throw new Error("Vercel production 또는 preview 빌드에서만 실행할 수 있습니다.");
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
if (!commit || !/^[0-9a-f]{7,40}$/.test(commit))
  throw new Error("Vercel Git 커밋 식별자가 필요합니다.");

const env = {
  ...loadEnv("production", process.cwd(), ""),
  ...process.env,
  VITE_APP_VERSION: commit,
  VITE_DEPLOY_ENV: target,
};
console.log(validateEnv(env, { release: true }));
console.log(
  target === "preview"
    ? "Vercel Preview: 서비스 연결은 검사하지만 설치 안내와 설치 지표는 차단합니다."
    : "Vercel Production: 고정 origin과 커밋 버전으로 빌드합니다.",
);
if (process.argv.includes("--check-only")) process.exit(0);

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : "npm";
const args = npmCli ? [npmCli, "run", "build"] : ["run", "build"];
const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
