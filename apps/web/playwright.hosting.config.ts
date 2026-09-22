import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../../tests/e2e/assets",
  outputDir: "../../tests/artifacts/assets",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4175" },
  webServer: {
    command: "node scripts/vercel-static-server.mjs",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
