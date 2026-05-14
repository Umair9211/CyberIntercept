"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import TrafficTable from "@/components/TrafficTable";
import RequestPanel from "@/components/RequestPanel";
import {
  BASE_URL,
  startProxy,
  stopProxy,
  enableIntercept,
  disableIntercept,
  getPendingRequests,
  getCapturedTraffic,
  forwardRequest,
  dropRequest,
  normalizeTrafficItem,
  clearTraffic,
} from "@/lib/api";

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

  const captureRef = useRef(captureOn);
  const interceptRef = useRef(interceptOn);
  useEffect(() => {
    captureRef.current = captureOn;
  }, [captureOn]);
  useEffect(() => {
    interceptRef.current = interceptOn;
  }, [interceptOn]);

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
      const base = BASE_URL;
      navigator.sendBeacon(
        `${base}/proxy/intercept/forward/all`,
        new Blob([], { type: "application/json" })
      );
      navigator.sendBeacon(`${base}/proxy/stop?port=${proxyPort}`);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [proxyPort]);

  const stats = useMemo(
    () => ({
      total: displayTraffic.length,
      successful: displayTraffic.filter((r) => r.status >= 200 && r.status < 300).length,
      errors: displayTraffic.filter((r) => r.status >= 400).length,
    }),
    [displayTraffic]
  );

  const handleToggleCapture = useCallback(
    async (port) => {
      if (captureOn) {
        await stopProxy(port);
        if (interceptOn) {
          await disableIntercept().catch(() => {});
          setInterceptOn(false);
        }
        setCaptureOn(false);
      } else {
        await startProxy(port);
        setProxyPort(port);
        setCaptureOn(true);
      }
    },
    [captureOn, interceptOn]
  );

  const handleToggleIntercept = useCallback(async () => {
    if (interceptOn) {
      await disableIntercept();
      setInterceptOn(false);
    } else {
      await enableIntercept();
      setInterceptOn(true);
    }
  }, [interceptOn]);

  const handleClearTraffic = useCallback(async () => {
    try {
      await clearTraffic();
    } catch {
      // still clear local UI if backend is unreachable
    }
    setCapturedTraffic([]);
    setPendingTraffic([]);
    setSelectedRequest(null);
    setSelectedIds([]);
  }, []);

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">CyberIntercept</p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-100">Traffic dashboard</h1>
        </div>

        <div className="mx-auto max-w-[1600px] px-0 py-6 sm:px-0 lg:px-0">
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live dashboard</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-100">Intercepted traffic</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    Real-time traffic captured through the mitmproxy listener.
                  </p>
                </div>
                <div
                  className={`rounded-3xl px-4 py-3 text-sm
                  ${captureOn ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-950/90 text-slate-400"}`}
                >
                  {captureOn ? "● Capture active" : "Capture stopped"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-950/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Captured</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-100">{stats.total}</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Successful</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-300">{stats.successful}</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Alerts</p>
                  <p className="mt-3 text-3xl font-semibold text-amber-300">{stats.errors}</p>
                </div>
              </div>
            </div>

            <ControlPanel
              interceptOn={interceptOn}
              captureOn={captureOn}
              onToggleIntercept={handleToggleIntercept}
              onToggleCapture={handleToggleCapture}
              onClearTraffic={handleClearTraffic}
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
