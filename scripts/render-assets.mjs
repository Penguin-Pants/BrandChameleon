// Renders PNG icons and AMO screenshots with Playwright Chromium (FR-56, FR-57).
// Usage: npm run assets
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startServer } from "../tests/support/server.js";
import { installMockBrowser } from "../tests/support/mock-browser.js";
import { scanFixture } from "../tests/support/scan.js";
import { analyze } from "../src/shared/analyze.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4190;
const BASE = `http://127.0.0.1:${PORT}`;

async function renderIcons(browser) {
  const svg = await readFile(`${ROOT}src/icons/icon.svg`, "utf8");
  for (const size of [48, 96, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`,
    );
    await page.screenshot({ path: `${ROOT}src/icons/icon-${size}.png`, omitBackground: true });
    await page.close();
  }
}

async function renderScreenshots(browser) {
  const scanPage = await browser.newPage({ baseURL: BASE });
  const model = analyze(await scanFixture(scanPage, "brand-basic"), {
    scannedAt: "2026-09-23T12:00:00.000Z",
    extVersion: "1.0",
  });
  await scanPage.close();
  model.source.url = "https://acme.example/";
  model.source.hostname = "acme.example";
  model.logos = model.logos.map((logo) => ({ ...logo, url: `https://acme.example/${logo.url.split("/").pop()}` }));
  const initial = { "scan:1": { status: "done", scanId: "shot", hostname: "acme.example", model } };

  const shots = [
    { file: "1-colors.png", scroll: 0 },
    { file: "2-typography.png", scroll: "#h-typography" },
    { file: "3-markdown.png", scroll: "#h-markdown" },
  ];
  for (const shot of shots) {
    // AMO shows screenshots at 4:3; 2400 x 1800 is its full size.
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, baseURL: BASE });
    await page.addInitScript(installMockBrowser, { initial });
    // Serve the fake site's logo files from the fixture assets.
    await page.route("https://acme.example/**", (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const file = name === "logo.svg" ? "logo.svg" : "favicon.svg";
      return route.fulfill({ path: `${ROOT}tests/fixtures/pages/assets/${file}`, contentType: "image/svg+xml" });
    });
    await page.goto("/scripts/screenshot-stage.html");
    const sidebar = page.frameLocator("#sidebar");
    await sidebar.locator("#view-review").waitFor();
    if (shot.scroll) await sidebar.locator(shot.scroll).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ROOT}amo/screenshots/${shot.file}` });
    await page.close();
  }
}

const server = await startServer(PORT);
const browser = await chromium.launch();
try {
  await renderIcons(browser);
  await renderScreenshots(browser);
} finally {
  await browser.close();
  server.close();
}
