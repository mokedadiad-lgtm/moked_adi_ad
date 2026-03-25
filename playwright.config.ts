import { defineConfig, devices } from "@playwright/test";

/** פורט ייעודי לבדיקות — כדי שלא יתנגש ב־`npm run dev` על 3000. אם `EADDRINUSE`, הגדר PLAYWRIGHT_PORT */
const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT ?? "3334";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PLAYWRIGHT_PORT}`;

/**
 * E2E: מפעילים שרת dev על פורט ייעודי.
 * PLAYWRIGHT_BASE_URL — לציון בסיס אחר (למשל staging).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "he-IL",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PLAYWRIGHT_PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
