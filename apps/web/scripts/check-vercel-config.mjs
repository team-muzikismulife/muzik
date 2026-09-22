import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("../..");
const config = JSON.parse(await fs.readFile(path.join(root, "vercel.json"), "utf8"));
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const requiredRewrites = [
  "/login",
  "/auth/callback",
  "/operations",
  "/r/:code",
  "/room/:path*",
];
if (config.$schema !== "https://openapi.vercel.sh/vercel.json")
  throw new Error("Vercel 공식 설정 스키마가 필요합니다.");
if (
  config.framework !== "vite" ||
  config.installCommand !== "npm --prefix apps/web ci" ||
  config.buildCommand !== "npm --prefix apps/web run build:vercel" ||
  config.outputDirectory !== "apps/web/dist"
)
  throw new Error("저장소 루트 기준 Vercel install/build/output 설정이 다릅니다.");
if (config.functions || config.crons)
  throw new Error("정적 PWA에 Vercel Functions/cron을 추가할 수 없습니다.");
const rewrites = new Map(
  (config.rewrites || []).map(({ source, destination }) => [source, destination]),
);
for (const source of requiredRewrites)
  if (rewrites.get(source) !== "/index.html")
    throw new Error(`SPA 직접 진입 rewrite가 없습니다: ${source}`);
if ([...rewrites.keys()].some((source) => source === "/(.*)" || source === "/:path*"))
  throw new Error("누락된 정적 자산까지 HTML로 바꾸는 catch-all rewrite는 금지합니다.");
const headers = config.headers || [];
const global = headers.find(({ source }) => source === "/(.*)")?.headers || [];
for (const [key, value] of [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
])
  if (!global.some((header) => header.key === key && header.value === value))
    throw new Error(`전역 보호 헤더가 없습니다: ${key}`);
for (const source of ["/sw.js", "/manifest.webmanifest", "/index.html"])
  if (
    !headers
      .find((entry) => entry.source === source)
      ?.headers.some(
        (header) =>
          header.key === "Cache-Control" && header.value.includes("must-revalidate"),
      )
  )
    throw new Error(`재검증 캐시 헤더가 없습니다: ${source}`);
if (pkg.scripts["build:vercel"] !== "node scripts/vercel-build.mjs")
  throw new Error("Vercel 빌드 스크립트가 고정되지 않았습니다.");
if (pkg.scripts["deploy:check"] || pkg.devDependencies?.wrangler)
  throw new Error("Cloudflare 배포 명령 또는 의존성이 활성 설정에 남아 있습니다.");
console.log("PASS Vercel 정적 PWA 설정 계약 (실제 프로젝트 연결/배포 검증 아님)");
