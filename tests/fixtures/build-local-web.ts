import { spawnSync } from "node:child_process";
import { localSettings } from "./local-supabase.ts";
const settings = localSettings();
const result = spawnSync("npm", ["run", "build"], {
  cwd: new URL("../../apps/web/", import.meta.url),
  env: {
    ...process.env,
    VITE_SUPABASE_URL: settings.API_URL,
    VITE_SUPABASE_ANON_KEY: settings.ANON_KEY,
  },
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
