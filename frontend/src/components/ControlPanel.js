"use client";

import { useState } from "react";

export default function ControlPanel({
  interceptOn,
  captureOn,
  port,
  onPortChange,
  onToggleIntercept,
  onToggleCapture,
}) {
  const [captureLoading, setCaptureLoading] = useState(false);
  const [interceptLoading, setInterceptLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggleCapture = async () => {
    setCaptureLoading(true);
    setError(null);
    try {
      await onToggleCapture(port);
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
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-xl dark:border-slate-800/80 dark:bg-slate-900/80 sm:max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">
            Intercept Control
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Session controls</h2>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/90">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Proxy port</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          mitmproxy will listen on this port. Change before starting capture.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min={1024}
            max={65535}
            value={port}
            disabled={captureOn}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) onPortChange(val);
            }}
            className={`w-32 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500/60 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-100
              ${captureOn ? "cursor-not-allowed opacity-50" : ""}`}
          />
          <span className="text-xs text-slate-500 dark:text-slate-500">
            {captureOn ? "Stop capture to change the port." : "Default: 8080"}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Capture mode</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {captureLoading ? "…" : captureOn ? "ON" : "OFF"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleCapture}
              disabled={captureLoading}
              aria-label="Toggle capture mode"
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition
                ${captureOn ? "bg-emerald-500/90" : "bg-slate-400 dark:bg-slate-700"}
                ${captureLoading ? "cursor-wait opacity-60" : ""}`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white transition dark:bg-slate-950
                  ${captureOn ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
            Start / stop the mitmproxy listener on port <span className="text-slate-700 dark:text-slate-300">{port}</span>.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Intercept</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {interceptLoading ? "…" : interceptOn ? "ON" : "OFF"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleIntercept}
              disabled={interceptLoading || !captureOn}
              aria-label="Toggle intercept mode"
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition
                ${interceptOn ? "bg-emerald-500/90" : "bg-slate-400 dark:bg-slate-700"}
                ${interceptLoading || !captureOn ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white transition dark:bg-slate-950
                  ${interceptOn ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
            {captureOn
              ? "Pause requests for manual forward/drop decisions."
              : "Start capture first to enable intercept."}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
}
