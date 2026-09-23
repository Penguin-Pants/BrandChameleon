import { defineConfig } from "@playwright/test";

export const PORT = 4173;
export const CROSS_ORIGIN_PORT = 4174;

export default defineConfig({
  testDir: "tests/browser",
  snapshotPathTemplate: "tests/snapshots/{arg}{ext}",
  fullyParallel: true,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: "chromium",
  },
  webServer: {
    command: `node tests/support/server.js ${PORT} ${CROSS_ORIGIN_PORT}`,
    url: `http://127.0.0.1:${PORT}/tests/fixtures/pages/brand-basic.html`,
    reuseExistingServer: !process.env.CI,
  },
});
