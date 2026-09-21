import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const target = path.join(root, "scratch/supabase-ci/supabase");
await fs.mkdir(path.join(target, "migrations"), { recursive: true });
let config = await fs.readFile(path.join(root, "supabase/config.toml"), "utf8");
config = config.replace(
  "[auth.email]\nenable_signup = false",
  "[auth.email]\nenable_signup = true",
);
config = config.replace(
  "[functions.muzik]",
  '[functions.muzik]\nentrypoint = "../../../tests/fixtures/edge.ts"',
);
config += "\n[auth.rate_limit]\nsign_in_sign_ups = 500\ntoken_refresh = 500\n";
await fs.writeFile(path.join(target, "config.toml"), config);
for (const file of await fs.readdir(path.join(root, "supabase/migrations")))
  await fs.copyFile(
    path.join(root, "supabase/migrations", file),
    path.join(target, "migrations", file),
  );
console.log("로컬 테스트 프로젝트 구성 완료 (운영 config 불변)");
