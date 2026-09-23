import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { button, scan, text } from "../support/synthetic.js";

// One mock `browser` for the module's lifetime; each test swaps behaviors.
const calls = [];
const storage = {};
const behavior = {
  executeScript: async () => [{ frameId: 0, result: validScan() }],
  tabsGet: async (id) => ({ id, url: "https://acme.example/" }),
};
let clickListener;

globalThis.browser = {
  action: { onClicked: { addListener: (fn) => (clickListener = fn) } },
  sidebarAction: {
    open: () => {
      calls.push("open");
      return Promise.resolve();
    },
  },
  scripting: {
    executeScript: (details) => {
      calls.push("executeScript");
      assert.equal(typeof details.func, "function");
      assert.equal(details.func.name, "collectPage");
      assert.ok(details.args[0].denylist.prefix.includes("onetrust-"));
      return behavior.executeScript(details);
    },
  },
  storage: {
    session: {
      set: async (items) => {
        for (const [key, value] of Object.entries(items)) {
          calls.push(`set ${key} ${value.status}`);
          storage[key] = structuredClone(value);
        }
      },
    },
  },
  tabs: { get: (id) => behavior.tabsGet(id) },
  runtime: { getManifest: () => ({ version: "0.1.0" }) },
};

function validScan() {
  return scan({ records: [text("rgb(0, 0, 0)"), button("rgb(99, 91, 255)", "rgb(255, 255, 255)")] });
}

await import("../../src/background/background.js");

const TAB = { id: 7, windowId: 3, url: "https://acme.example/" };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function reset() {
  calls.length = 0;
  for (const key of Object.keys(storage)) delete storage[key];
  behavior.executeScript = async () => [{ frameId: 0, result: validScan() }];
  behavior.tabsGet = async (id) => ({ id, url: TAB.url });
}

test("AC-03 click opens the sidebar before any await, then scans the tab", async () => {
  reset();
  const pending = clickListener(TAB);
  const synchronous = [...calls];
  assert.equal(synchronous[0], "open", "sidebarAction.open() must be the first call in the handler");
  assert.ok(!synchronous.includes("executeScript"), "the scan starts after the sidebar call");
  await pending;
  assert.deepEqual(calls, ["open", "set scan:3 scanning", "executeScript", "set scan:3 done"]);
  assert.equal(storage["scan:3"].model.source.hostname, "acme.example");
  assert.equal(storage["scan:3"].model.source.extVersion, "0.1.0");
});

test("FR-07 only the latest scan in a window publishes its result", async () => {
  reset();
  let releaseFirst;
  behavior.executeScript = () =>
    new Promise((resolve) => {
      releaseFirst = () => resolve([{ frameId: 0, result: validScan() }]);
    });
  const first = clickListener(TAB);
  await flush();
  behavior.executeScript = async () => [{ frameId: 0, result: validScan() }];
  await clickListener(TAB);
  const latestId = storage["scan:3"].scanId;
  assert.equal(storage["scan:3"].status, "done");
  releaseFirst();
  await first;
  assert.equal(storage["scan:3"].scanId, latestId);
});

test("errors map to restricted, changed and no-content", async () => {
  reset();
  behavior.executeScript = async () => {
    throw new Error("Missing host permission for the tab");
  };
  await clickListener(TAB);
  assert.equal(storage["scan:3"].error, "restricted");

  reset();
  behavior.executeScript = async () => {
    throw new Error("Something failed");
  };
  behavior.tabsGet = async () => {
    throw new Error("Invalid tab ID");
  };
  await clickListener(TAB);
  assert.equal(storage["scan:3"].error, "changed");

  reset();
  behavior.executeScript = async () => [{ frameId: 0, result: scan() }];
  await clickListener(TAB);
  assert.equal(storage["scan:3"].error, "no-content");
});

test("a scan that runs past 15 s stores the timeout error", async () => {
  reset();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    behavior.executeScript = () => new Promise(() => {});
    const pending = clickListener(TAB);
    await flush();
    mock.timers.tick(15000);
    await pending;
    assert.equal(storage["scan:3"].error, "timeout");
  } finally {
    mock.timers.reset();
  }
});
