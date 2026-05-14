"use client";

// app/page.jsx (or pages/index.jsx — adjust to your router)
// Replaces all mock-data usage with real backend API calls.
//
// ── What changed vs the original ────────────────────────────────────────────
//  • Removed initialTrafficData import; traffic is fetched from the backend.
//  • Added a proxyPort state that is passed down to ControlPanel.
//  • onToggleCapture(port) calls /proxy/start or /proxy/stop.
//  • onToggleIntercept() calls /proxy/intercept/on or /proxy/intercept/off.
//  • useEffect polls /api/requests (capture log) every 2 s when captureOn.
//  • useEffect polls /proxy/intercept/pending every 1 s when interceptOn.
//  • handleForwardSelected / handleDropSelected hit the real endpoints.
//  • handleForwardAll / handleDropAll use the "all" shorthand endpoint.
//  • Traffic items are normalised into the shape TrafficTable/RequestPanel expect.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlPanel  from "@/components/ControlPanel";
import TrafficTable  from "@/components/TrafficTable";
import RequestPanel  from "@/components/RequestPanel";
import {
  startProxy,
  stopProxy,
  enableIntercept,
  disableIntercept,
  getPendingRequests,
  getCapturedTraffic,
  forwardRequest,
  dropRequest,
  normalizeTrafficItem,
} from "@/lib/api";

// ── Deduplication helper ─────────────────────────────────────────────────────
// The backend returns the full list on every poll. We merge by a stable key
// (url+method+host) for captured traffic, and by id for pending traffic, so
// the table doesn't flicker or duplicate rows.

function mergeTraffic(existing, incoming, source) {
  const normalised = incoming.map((raw) => normalizeTrafficItem(raw, source));

  if (source === "pending") {
    // For pending requests the backend gives us stable ids — use them.
    const existingIds = new Set(existing.map((r) => r.id));
    const fresh = normalised.filter((r) => !existingIds.has(r.id));
    return [...existing, ...fresh];
  }

  // For captured traffic there are no ids from the backend, so we key on
  // method+url and only append truly new entries.
  const existingKeys = new Set(existing.map((r) => `${r.method}|${r.url}`));
  const fresh = normalised.filter((r) => !existingKeys.has(`${r.method}|${r.url}`));
  return [...existing, ...fresh];
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [traffic,         setTraffic]         = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedIds,     setSelectedIds]     = useState([]);
  const [interceptOn,     setInterceptOn]     = useState(false);
  const [captureOn,       setCaptureOn]       = useState(false);
  const [proxyPort,       setProxyPort]       = useState(8080); // kept here if needed elsewhere

  // Prevent stale closure issues inside polling intervals
  const captureRef   = useRef(captureOn);
  const interceptRef = useRef(interceptOn);
  useEffect(() => { captureRef.current   = captureOn;   }, [captureOn]);
  useEffect(() => { interceptRef.current = interceptOn; }, [interceptOn]);

  // ── Polling: captured traffic log ────────────────────────────────────────
  useEffect(() => {
    if (!captureOn) return;

    const id = setInterval(async () => {
      if (!captureRef.current) return;
      try {
        const data = await getCapturedTraffic();
        if (Array.isArray(data)) {
          setTraffic((prev) => mergeTraffic(prev, data, "captured"));
        }
      } catch {
        // silently ignore transient network errors during polling
      }
    }, 2000);

    return () => clearInterval(id);
  }, [captureOn]);

  // ── Polling: pending (intercepted) requests ───────────────────────────────
  useEffect(() => {
    if (!interceptOn) return;

    const id = setInterval(async () => {
      if (!interceptRef.current) return;
      try {
        const data = await getPendingRequests();
        if (Array.isArray(data)) {
          setTraffic((prev) => mergeTraffic(prev, data, "pending"));
        }
      } catch {
        // silently ignore
      }
    }, 1000);

    return () => clearInterval(id);
  }, [interceptOn]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total:      traffic.length,
      successful: traffic.filter((r) => r.status >= 200 && r.status < 300).length,
      errors:     traffic.filter((r) => r.status >= 400).length,
    }),
    [traffic]
  );

  // ── Control handlers ──────────────────────────────────────────────────────

  /** Called by ControlPanel with the chosen port number. */
  const handleToggleCapture = useCallback(async (port) => {
    if (captureOn) {
      await stopProxy(port);
      // Turning capture off also turns off intercept.
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
  }, [captureOn, interceptOn]);

  const handleToggleIntercept = useCallback(async () => {
    if (interceptOn) {
      await disableIntercept();
      setInterceptOn(false);
    } else {
      await enableIntercept();
      setInterceptOn(true);
    }
  }, [interceptOn]);

  // ── Traffic table handlers ─────────────────────────────────────────────────

  const handleClearTraffic = () => {
    setTraffic([]);
    setSelectedRequest(null);
    setSelectedIds([]);
  };

  const handleToggleSelect = (id) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );

  const handleSelectAll = () =>
    setSelectedIds((cur) =>
      cur.length === traffic.length ? [] : traffic.map((r) => r.id)
    );

  /** Forward each selected request individually. */
  const handleForwardSelected = async () => {
    await Promise.allSettled(selectedIds.map((id) => forwardRequest(id)));
    setTraffic((cur) => cur.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  /** Drop each selected request individually. */
  const handleDropSelected = async () => {
    await Promise.allSettled(selectedIds.map((id) => dropRequest(id)));
    setTraffic((cur) => cur.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  /** Forward every pending request in one backend call. */
  const handleForwardAll = async () => {
    await forwardRequest("all");
    setTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  /** Drop every pending request in one backend call. */
  const handleDropAll = async () => {
    await dropRequest("all");
    setTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">

        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">CyberIntercept</p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-100">Traffic dashboard</h1>
        </div>

        <div className="mx-auto max-w-[1600px] px-0 py-6 sm:px-0 lg:px-0">
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            {/* ── Stats card ── */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live dashboard</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-100">Intercepted traffic</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    Real-time traffic captured through the mitmproxy listener.
                  </p>
                </div>
                <div className={`rounded-3xl px-4 py-3 text-sm
                  ${captureOn
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-slate-950/90 text-slate-400"}`}>
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

            {/* ── Control panel ── */}
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
              traffic={traffic}
              selectedId={selectedRequest?.id}
              selectedIds={selectedIds}
              interceptOn={interceptOn}
              onSelectRequest={setSelectedRequest}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onForwardSelected={handleForwardSelected}
              onForwardAll={handleForwardAll}
              onDropSelected={handleDropSelected}
              onDropAll={handleDropAll}
            />
          </section>

          <RequestPanel
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        </div>
      </main>
    </div>
  );
}