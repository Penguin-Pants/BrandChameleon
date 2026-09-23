// A small stand-in for the WebExtension `browser` API used by the sidebar.
// Installed with page.addInitScript(installMockBrowser, options). Session
// storage lives in the page's sessionStorage, so it survives a reload.
export function installMockBrowser({ initial = {}, version = "0.1.0", pathIncludes = "/src/sidebar/" } = {}) {
  if (!location.pathname.includes(pathIncludes)) return;
  const KEY = "__mockSessionStorage";
  const read = () => JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  if (sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, JSON.stringify(initial));
  const listeners = [];
  const write = (items) => {
    const data = read();
    const changes = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: data[key], newValue: value };
      data[key] = value;
    }
    sessionStorage.setItem(KEY, JSON.stringify(data));
    for (const listener of listeners) listener(JSON.parse(JSON.stringify(changes)), "session");
  };
  const windowId = Number(new URLSearchParams(location.search).get("window") ?? 1);
  window.browser = {
    windows: { getCurrent: async () => ({ id: windowId }) },
    runtime: { getManifest: () => ({ version }) },
    storage: {
      session: {
        get: async (keys) => {
          const data = read();
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
        },
        set: async (items) => write(JSON.parse(JSON.stringify(items))),
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
  window.__mock = { set: write, get: read };
}
