import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { localSettings } from "./local-supabase.ts";
const settings = localSettings();
for (const version of ["b", "a"]) {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: new URL("../../apps/web/", import.meta.url),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: settings.API_URL,
      VITE_SUPABASE_ANON_KEY: settings.ANON_KEY,
      VITE_PUBLIC_ORIGIN: "https://127.0.0.1:4174",
      VITE_APP_VERSION: version,
    },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  await fs.cp(
    new URL("../../apps/web/dist/", import.meta.url),
    new URL(`../../scratch/pwa-versions/${version}/`, import.meta.url),
    { recursive: true },
  );
}
