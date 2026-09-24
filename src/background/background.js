// Toolbar click: open the sidebar, scan the active tab, store the result (FR-04 to FR-07).
// Save the file that the sidebar hands over at Download (FR-48).
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

// FR-48: the sidebar writes the file to `download:<windowId>` and closes at
// once. A blob: URL made in the sidebar is revoked when it closes, and Firefox
// rejects data: URLs for downloads, so the URL is made here instead.
export async function saveFile(key, { filename, text }) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  // download() can resolve before Firefox reads the URL, so revoke it later.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  try {
    await browser.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false });
  } finally {
    await browser.storage.session.remove(key);
  }
}

export function handleStorageChange(changes, area) {
  if (area !== "session") return;
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith("download:") || !change.newValue) continue;
    saveFile(key, change.newValue).catch((error) => console.error("[BrandChameleon]", error));
  }
}

browser.action.onClicked.addListener(handleClick);
// A persistent event: it wakes the background when it is suspended.
browser.storage.onChanged.addListener(handleStorageChange);
