const STATE_KEY = "ci-session-state";
const TABS_KEY = "ci-dashboard-tabs";
const TAB_STALE_MS = 8000;

function readTabs() {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeTabs(tabs) {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

/** Register this dashboard tab; returns tab id. */
export function registerDashboardTab() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}`;
  const tabs = readTabs();
  tabs[id] = Date.now();
  writeTabs(tabs);
  return id;
}

export function touchDashboardTab(tabId) {
  const tabs = readTabs();
  if (tabs[tabId] != null) {
    tabs[tabId] = Date.now();
    writeTabs(tabs);
  }
}

/** Remove tab; returns true if no other live dashboard tabs remain. */
export function unregisterDashboardTab(tabId) {
  const tabs = readTabs();
  delete tabs[tabId];
  const now = Date.now();
  const live = Object.entries(tabs).filter(([, ts]) => now - ts < TAB_STALE_MS);
  writeTabs(Object.fromEntries(live));
  return live.length === 0;
}

export function publishSessionState({ captureOn, interceptOn, port }) {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        captureOn: !!captureOn,
        interceptOn: !!interceptOn,
        port: port ?? 8080,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

export function readSessionState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Listen for capture/intercept changes from other tabs. */
export function subscribeSessionState(handler) {
  const onStorage = (event) => {
    if (event.key !== STATE_KEY || !event.newValue) return;
    try {
      handler(JSON.parse(event.newValue));
    } catch {
      // ignore
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
