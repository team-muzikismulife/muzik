import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
export const requireWeb = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { createClient } = requireWeb("@supabase/supabase-js");
const root = path.resolve(import.meta.dirname, "../..");
export function localSettings() {
  const cli = path.join(root, "apps/web/node_modules/.bin/supabase");
  const data = JSON.parse(
    execFileSync(
      cli,
      [
        "status",
        "--workdir",
        path.join(root, "scratch/supabase-ci"),
        "-o",
        "json",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost):54321$/.test(data.API_URL))
    throw new Error("로컬 DB 테스트만 허용");
  return data;
}
export function clients(settings = localSettings()) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    settings.API_URL,
    settings.SERVICE_ROLE_KEY,
    options,
  );
  const anonymous = createClient(settings.API_URL, settings.ANON_KEY, options);
  const user = async (google = true) => {
    const email = `test-${crypto.randomUUID()}@muzik.invalid`;
    const password = crypto.randomUUID();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw new Error("로컬 사용자 fixture 생성 실패");
    const client = createClient(settings.API_URL, settings.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error("로컬 인증 fixture 실패");
    if (google) {
      const updated = await admin.auth.admin.updateUserById(
        created.data.user.id,
        { app_metadata: { provider: "google", providers: ["google"] } },
      );
      if (updated.error) throw new Error("로컬 Google claim fixture 실패");
    }
    return { id: created.data.user.id, client, session: login.data.session };
  };
  return { settings, admin, anonymous, user };
}
export async function invoke(
  settings: any,
  session: any,
  action: string,
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
  outage = false,
) {
  const response = await fetch(`${settings.API_URL}/functions/v1/muzik`, {
    method: "POST",
    headers: {
      apikey: settings.ANON_KEY,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      "Content-Type": "application/json",
      ...(outage ? { "x-muzik-test-video-fail": "1" } : {}),
    },
    body: JSON.stringify({ action, payload, requestId }),
  });
  return { status: response.status, body: await response.json() };
}
