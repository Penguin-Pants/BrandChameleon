// Runs the real collector on a fixture page, the same way Firefox injects it.
import { collectPage } from "../../src/collector/collect-page.js";
import { SCAN_LIMITS } from "../../src/shared/constants.js";
import { OVERLAY_DENYLIST } from "../../src/shared/overlay-denylist.js";

export const COLLECTOR_OPTIONS = { denylist: OVERLAY_DENYLIST, ...SCAN_LIMITS };

export async function scanFixture(page, name) {
  await page.goto(`/tests/fixtures/pages/${name}.html`);
  return page.evaluate(collectPage, COLLECTOR_OPTIONS);
}
