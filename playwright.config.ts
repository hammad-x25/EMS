import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const chromePath = "/usr/bin/google-chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4000",
    headless: true,
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : undefined,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- -p 4000",
    url: "http://localhost:4000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
