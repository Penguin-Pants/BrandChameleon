// Toolbar click: open the sidebar, scan the active tab, store the result (FR-04 to FR-07).
import { collectPage } from "../collector/collect-page.js";
import { analyze, ScanError } from "../shared/analyze.js";
import { SCAN_LIMITS, SCAN_TIMEOUT_MS } from "../shared/constants.js";
import { OVERLAY_DENYLIST } from "../shared/overlay-denylist.js";
import { cleanText } from "../shared/sanitize.js";

export const scanKey = (windowId) => `scan:${windowId}`;

const latestScan = new Map();

function hostOf(url) {
  try {
    return cleanText(new URL(url).hostname, 253);
  } catch {
    return "";
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ScanError("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runCollector(tabId) {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    func: collectPage,
    args: [{ denylist: OVERLAY_DENYLIST, ...SCAN_LIMITS }],
  });
  if (!injection || injection.error || !injection.result) {
    throw injection?.error ?? new Error("The collector returned no result.");
  }
  return injection.result;
}

const withoutHash = (url) => (url ?? "").split("#")[0];

/** Throws "changed" when the tab now shows another document than the one scanned. */
async function assertSamePage(tabId, scannedUrl) {
  let current;
  try {
    current = await browser.tabs.get(tabId);
  } catch {
    throw new ScanError("changed");
  }
  // Without a URL (permission lost) there is nothing to compare, so accept.
  if (current.url && withoutHash(current.url) !== withoutHash(scannedUrl)) throw new ScanError("changed");
}

async function errorCode(error, tab) {
  if (error instanceof ScanError) return error.code;
  if (/navigat|closed|destroyed|no tab|aborted|unloaded/i.test(String(error?.message ?? error))) return "changed";
  try {
    const current = await browser.tabs.get(tab.id);
    if (tab.url && current.url && current.url !== tab.url) return "changed";
  } catch {
    return "changed";
  }
  return "restricted";
}

export async function startScan(tab) {
  const scanId = crypto.randomUUID();
  const windowId = tab.windowId;
  latestScan.set(windowId, scanId);
  const hostname = hostOf(tab.url);
  await browser.storage.session.set({
    [scanKey(windowId)]: { status: "scanning", scanId, hostname, startedAt: Date.now() },
  });

  let result;
  try {
    const scan = await withTimeout(runCollector(tab.id), SCAN_TIMEOUT_MS);
    await assertSamePage(tab.id, scan.page.url);
    const model = analyze(scan, {
      scannedAt: new Date().toISOString(),
      extVersion: browser.runtime.getManifest().version,
    });
    result = { status: "done", scanId, hostname: model.source.hostname, model };
  } catch (error) {
    const code = await errorCode(error, tab);
    if (!(error instanceof ScanError)) console.error("[BrandChameleon]", error);
    result = { status: "error", scanId, hostname, error: code };
  }

  // FR-07: only the latest scan in a window may publish its result.
  if (latestScan.get(windowId) !== scanId) return;
  await browser.storage.session.set({ [scanKey(windowId)]: result });
}

export function handleClick(tab) {
  // Firefox allows sidebarAction.open() only inside a user input handler,
  // so it must run before the first await.
  browser.sidebarAction.open().catch((error) => console.error("[BrandChameleon]", error));
  return startScan(tab);
}

browser.action.onClicked.addListener(handleClick);
