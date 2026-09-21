import { loadEnv } from "vite";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
for (const key of Object.keys(env))
  if (/^VITE_.*(?:SECRET|SERVICE_ROLE|YOUTUBE.*KEY)/i.test(key) && env[key])
    throw new Error(`서버 전용 값은 VITE 환경변수에 둘 수 없습니다: ${key}`);
const url = env.VITE_SUPABASE_URL?.trim(),
  key = env.VITE_SUPABASE_ANON_KEY?.trim();
const release = process.argv.includes("--release");
if (
  release &&
  (!url ||
    !key ||
    !env.VITE_PUBLIC_ORIGIN ||
    !/^[0-9a-f]{7,40}$/.test(env.VITE_APP_VERSION || ""))
)
  throw new Error(
    "정식 빌드에는 Supabase 공개 URL/키, 고정 HTTPS origin, 배포 커밋 VITE_APP_VERSION이 모두 필요합니다.",
  );
if (env.VITE_PUBLIC_ORIGIN) {
  const origin = new URL(env.VITE_PUBLIC_ORIGIN);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== env.VITE_PUBLIC_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw new Error("설치 주소는 경로 없는 고정 HTTPS origin이어야 합니다.");
}
if (Boolean(url) !== Boolean(key))
  throw new Error(
    "Supabase 공개 URL과 공개 키를 함께 설정하거나 모두 비워 주세요.",
  );
if (url && key) {
  const parsed = new URL(url);
  if (parsed.origin !== url || parsed.username || parsed.password)
    throw new Error("Supabase URL에는 경로·쿼리·인증 정보를 넣을 수 없습니다.");
  if (
    release &&
    (parsed.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
  )
    throw new Error("정식 빌드에는 실제 HTTPS Supabase 주소가 필요합니다.");
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("HTTPS 또는 로컬 테스트 주소만 허용합니다.");
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try {
      role = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      ).role;
    } catch {}
    if (role !== "anon")
      throw new Error("클라이언트에는 공개 anon/publishable 키만 허용합니다.");
  }
}
console.log(
  url
    ? "공개 Supabase 설정 형식 검사 완료 (실연동 검증 아님)"
    : "미연동 공개 화면 빌드: 로그인·저장 비활성",
);
