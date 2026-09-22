import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../../tests/e2e/pwa",
  outputDir: "../../tests/artifacts/pwa",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 390, height: 844 },
    launchOptions: { args: ["--ignore-certificate-errors"] },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
