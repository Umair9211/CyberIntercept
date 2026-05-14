"use client";

// components/ControlPanel.jsx
// Changes vs original:
//   1. Added a "Proxy port" number input (default 8080).
//   2. onToggleCapture(port) now receives the current port so the parent
//      can call /proxy/start?port=N or /proxy/stop?port=N.
//   3. Toggle buttons are disabled while an async API call is in-flight
//      to prevent double-clicks from sending conflicting requests.
//   4. Error messages surface inline so the user knows if the backend
//      rejected the call.

import { useState } from "react";

export default function ControlPanel({
  interceptOn,
  captureOn,
  onToggleIntercept,
  onToggleCapture,
  onClearTraffic,
}) {
  const [port, setPort]           = useState(8080);
  const [captureLoading, setCaptureLoading]     = useState(false);
  const [interceptLoading, setInterceptLoading] = useState(false);
  const [error, setError]         = useState(null);

  const handleToggleCapture = async () => {
    setCaptureLoading(true);
    setError(null);
    try {
      await onToggleCapture(port);         // parent handles the fetch
    } catch (err) {
      setError(err.message ?? "Failed to toggle capture.");
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleToggleIntercept = async () => {
    setInterceptLoading(true);
    setError(null);
    try {
      await onToggleIntercept();
    } catch (err) {
      setError(err.message ?? "Failed to toggle intercept.");
    } finally {
      setInterceptLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-xl sm:max-w-2xl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Intercept Control
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            Session controls
          </h2>
        </div>
        <button
          type="button"
          onClick={onClearTraffic}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
        >
          Clear traffic
        </button>
      </div>

      {/* ── Proxy port input ── */}
      <div className="mt-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
        <p className="text-sm font-medium text-slate-300">Proxy port</p>
        <p className="mt-1 text-xs text-slate-500">
          mitmproxy will listen on this port. Change before starting capture.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min={1024}
            max={65535}
            value={port}
            disabled={captureOn}               // lock while proxy is running
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) setPort(val);
            }}
            className={`w-32 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 outline-none transition
              focus:border-emerald-500/60
              ${captureOn ? "cursor-not-allowed opacity-50" : ""}`}
          />
          <span className="text-xs text-slate-500">
            {captureOn
              ? "Stop capture to change the port."
              : "Default: 8080"}
          </span>
        </div>
      </div>

      {/* ── Toggle cards ── */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Capture mode */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Capture mode</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {captureLoading ? "…" : captureOn ? "ON" : "OFF"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleCapture}
              disabled={captureLoading}
              aria-label="Toggle capture mode"
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition
                ${captureOn ? "bg-emerald-500/90" : "bg-slate-700"}
                ${captureLoading ? "cursor-wait opacity-60" : ""}`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-slate-950 transition
                  ${captureOn ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Start / stop the mitmproxy listener on port{" "}
            <span className="text-slate-300">{port}</span>.
          </p>
        </div>

        {/* Intercept mode */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Intercept</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">
                {interceptLoading ? "…" : interceptOn ? "ON" : "OFF"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleIntercept}
              disabled={interceptLoading || !captureOn}  // intercept requires capture
              aria-label="Toggle intercept mode"
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition
                ${interceptOn ? "bg-emerald-500/90" : "bg-slate-700"}
                ${interceptLoading || !captureOn ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-slate-950 transition
                  ${interceptOn ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {captureOn
              ? "Pause requests for manual forward/drop decisions."
              : "Start capture first to enable intercept."}
          </p>
        </div>
      </div>

      {/* ── Inline error ── */}
      {error && (
        <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
          ⚠ {error}
        </p>
      )}
    </section>
  );
}