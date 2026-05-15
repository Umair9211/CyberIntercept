"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import TrafficTable from "@/components/TrafficTable";
import RequestPanel from "@/components/RequestPanel";
import { ThemeToggle } from "@/components/ThemeProvider";
import {
  BASE_URL,
  startProxy,
  stopProxy,
  enableIntercept,
  disableIntercept,
  getProxyStatus,
  getPendingRequests,
  getCapturedTraffic,
  forwardRequest,
  dropRequest,
  normalizeTrafficItem,
  clearTraffic,
} from "@/lib/api";
import {
  publishSessionState,
  readSessionState,
  registerDashboardTab,
  subscribeSessionState,
  touchDashboardTab,
  unregisterDashboardTab,
} from "@/lib/sessionState";

function mergeCapturedTraffic(existing, incoming) {
  const normalised = incoming.map((raw) => normalizeTrafficItem(raw, "captured"));
  const existingKeys = new Set(existing.map((r) => `${r.method}|${r.url}`));
  const fresh = normalised.filter((r) => !existingKeys.has(`${r.method}|${r.url}`));
  return [...existing, ...fresh];
}

export default function Home() {
  const [capturedTraffic, setCapturedTraffic] = useState([]);
  const [pendingTraffic, setPendingTraffic] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [interceptOn, setInterceptOn] = useState(false);
  const [captureOn, setCaptureOn] = useState(false);
  const [proxyPort, setProxyPort] = useState(8080);
  const [splash, setSplash] = useState(true);
  const tabIdRef = useRef(null);

  const captureRef = useRef(captureOn);
  const interceptRef = useRef(interceptOn);

  const applySessionState = useCallback(({ captureOn: cap, interceptOn: ic, port }) => {
    if (typeof cap === "boolean") setCaptureOn(cap);
    if (typeof ic === "boolean") setInterceptOn(ic);
    if (typeof port === "number" && !Number.isNaN(port)) setProxyPort(port);
  }, []);

  const syncFromBackend = useCallback(async (portHint = 8080) => {
    try {
      const status = await getProxyStatus(portHint);
      const cap = !!status.capture_on;
      const ic = !!status.intercept_on;
      const port = status.port ?? portHint;
      setCaptureOn(cap);
      setInterceptOn(ic);
      setProxyPort(port);
      publishSessionState({ captureOn: cap, interceptOn: ic, port });
      return { captureOn: cap, interceptOn: ic, port };
    } catch {
      const cached = readSessionState();
      if (cached) applySessionState(cached);
      return null;
    }
  }, [applySessionState]);
  useEffect(() => {
    captureRef.current = captureOn;
  }, [captureOn]);
  useEffect(() => {
    interceptRef.current = interceptOn;
  }, [interceptOn]);

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      await syncFromBackend(8080);
      if (!cancelled) setSplash(false);
    })();
    const fallback = window.setTimeout(() => {
      if (!cancelled) setSplash(false);
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [syncFromBackend]);

  useEffect(() => {
    tabIdRef.current = registerDashboardTab();
    const heartbeat = setInterval(() => {
      if (tabIdRef.current) touchDashboardTab(tabIdRef.current);
    }, 3000);
    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    return subscribeSessionState((state) => {
      applySessionState({
        captureOn: state.captureOn,
        interceptOn: state.interceptOn,
        port: state.port,
      });
    });
  }, [applySessionState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") syncFromBackend(proxyPort);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncFromBackend, proxyPort]);

  const displayTraffic = useMemo(
    () => (interceptOn ? pendingTraffic : capturedTraffic),
    [interceptOn, pendingTraffic, capturedTraffic]
  );

  useEffect(() => {
    if (!captureOn || interceptOn) return;

    const tick = async () => {
      if (!captureRef.current || interceptRef.current) return;
      try {
        const data = await getCapturedTraffic();
        if (Array.isArray(data)) {
          setCapturedTraffic((prev) => mergeCapturedTraffic(prev, data));
        }
      } catch {
        // ignore transient polling errors
      }
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [captureOn, interceptOn]);

  useEffect(() => {
    if (!interceptOn) return;

    const tick = async () => {
      if (!interceptRef.current) return;
      try {
        const data = await getPendingRequests();
        if (Array.isArray(data)) {
          setPendingTraffic(data.map((raw) => normalizeTrafficItem(raw, "pending")));
        }
      } catch {
        // ignore
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [interceptOn]);

  useEffect(() => {
    const handleUnload = () => {
      const tabId = tabIdRef.current;
      const isLastTab = tabId ? unregisterDashboardTab(tabId) : true;
      if (!isLastTab) return;

      const base = BASE_URL;
      const blob = new Blob([], { type: "application/json" });
      navigator.sendBeacon(`${base}/proxy/intercept/forward/all`, blob);
      navigator.sendBeacon(`${base}/proxy/stop?port=${proxyPort}`);
      fetch(`${base}/api/requests`, { method: "DELETE", keepalive: true }).catch(() => {});
      publishSessionState({ captureOn: false, interceptOn: false, port: proxyPort });
    };
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [proxyPort]);

  const stats = useMemo(
    () => ({
      total: displayTraffic.length,
      successful: displayTraffic.filter((r) => r.status >= 200 && r.status < 300).length,
    }),
    [displayTraffic]
  );

  const resetLocalTraffic = useCallback(() => {
    setCapturedTraffic([]);
    setPendingTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  }, []);

  const handleToggleCapture = useCallback(
    async (port) => {
      if (captureOn) {
        await stopProxy(port);
        if (interceptOn) {
          await disableIntercept().catch(() => {});
        }
        setCaptureOn(false);
        setInterceptOn(false);
        publishSessionState({ captureOn: false, interceptOn: false, port });
      } else {
        await startProxy(port);
        setProxyPort(port);
        setCaptureOn(true);
        publishSessionState({ captureOn: true, interceptOn, port });
      }
    },
    [captureOn, interceptOn]
  );

  const handleToggleIntercept = useCallback(async () => {
    if (interceptOn) {
      await disableIntercept();
      setCapturedTraffic((prev) => {
        const ids = new Set(prev.map((r) => r.id));
        const additions = pendingTraffic
          .filter((r) => r.id && !ids.has(r.id))
          .map((r) => ({ ...r, _source: "captured" }));
        return [...prev, ...additions];
      });
      setPendingTraffic([]);
      setInterceptOn(false);
      publishSessionState({ captureOn, interceptOn: false, port: proxyPort });
    } else {
      await enableIntercept();
      setInterceptOn(true);
      publishSessionState({ captureOn, interceptOn: true, port: proxyPort });
    }
  }, [interceptOn, pendingTraffic, captureOn, proxyPort]);

  const handleClearTraffic = useCallback(async () => {
    try {
      await clearTraffic();
    } catch {
      // still clear local UI if backend is unreachable
    }
    resetLocalTraffic();
  }, [resetLocalTraffic]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);

  const handleForwardSelected = useCallback(async () => {
    await Promise.allSettled(selectedIds.map((id) => forwardRequest(id)));
    setPendingTraffic((cur) => cur.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  }, [selectedIds]);

  const handleDropSelected = useCallback(async () => {
    await Promise.allSettled(selectedIds.map((id) => dropRequest(id)));
    setPendingTraffic((cur) => cur.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  }, [selectedIds]);

  const handleForwardAll = useCallback(async () => {
    await forwardRequest("all");
    setPendingTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  }, []);

  const handleDropAll = useCallback(async () => {
    await dropRequest("all");
    setPendingTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {splash && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-slate-100/95 backdrop-blur-sm dark:bg-slate-950/95">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading CyberIntercept…</p>
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              CyberIntercept
            </h1>
            <p className="mt-2 text-lg font-medium text-slate-600 sm:text-xl dark:text-slate-300">
              Traffic dashboard
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto max-w-[1600px] px-0 py-6 sm:px-0 lg:px-0">
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl dark:border-slate-800/80 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">Live dashboard</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Intercepted traffic</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Real-time traffic captured through the mitmproxy listener.
                  </p>
                </div>
                <div
                  className={`rounded-3xl px-4 py-3 text-sm
                  ${captureOn ? "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-950/90 dark:text-slate-400"}`}
                >
                  {captureOn ? "● Capture active" : "Capture stopped"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-transparent dark:bg-slate-950/90">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">Captured</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{stats.total}</p>
                </div>
                
              </div>
            </div>

            <ControlPanel
              interceptOn={interceptOn}
              captureOn={captureOn}
              port={proxyPort}
              onPortChange={setProxyPort}
              onToggleIntercept={handleToggleIntercept}
              onToggleCapture={handleToggleCapture}
            />
          </section>

          <section className="mt-6">
            <TrafficTable
              traffic={displayTraffic}
              selectedId={selectedRequest?.id}
              selectedIds={selectedIds}
              interceptOn={interceptOn}
              onSelectRequest={setSelectedRequest}
              onToggleSelect={handleToggleSelect}
              onForwardSelected={handleForwardSelected}
              onForwardAll={handleForwardAll}
              onDropSelected={handleDropSelected}
              onDropAll={handleDropAll}
              onClearTraffic={handleClearTraffic}
            />
          </section>

          {selectedRequest && (
            <RequestPanel
              key={selectedRequest.id}
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
