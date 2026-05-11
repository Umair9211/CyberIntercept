"use client";

import { useEffect, useState } from "react";

export default function RequestPanel({ request, onClose }) {
  const [fullRequest, setFullRequest] = useState("");

  useEffect(() => {
    if (!request) {
      setFullRequest("");
      return;
    }

    const requestText = `${request.method} ${request.url} ${request.protocol}\n` +
      `Host: ${request.headers.Host}\n` +
      Object.entries(request.headers)
        .filter(([key]) => key !== "Host")
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n") +
      "\n\n" +
      (request.body || "");

    setFullRequest(requestText);
  }, [request]);

  if (!request) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-950/95 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-800/80 bg-slate-900/90 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Request inspector</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">{request.method} {request.url}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
          >
            Close inspector
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">URL</p>
              <p className="mt-3 break-words text-sm text-slate-100">{request.url}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Metadata</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-950/90 p-3">
                  <p className="text-slate-500">Method</p>
                  <p className="mt-1 text-slate-100">{request.method}</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-3">
                  <p className="text-slate-500">Protocol</p>
                  <p className="mt-1 text-slate-100">{request.protocol}</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-3">
                  <p className="text-slate-500">Status</p>
                  <p className="mt-1 text-slate-100">{request.status}</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-3">
                  <p className="text-slate-500">Time</p>
                  <p className="mt-1 text-slate-100">{request.time}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Full request</p>
                <p className="text-sm text-slate-500">Editable simulated request payload.</p>
              </div>
            </div>
            <textarea
              className="mt-4 min-h-[420px] w-full resize-none rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 text-sm text-slate-100 outline-none focus:border-emerald-500/80"
              value={fullRequest}
              onChange={(event) => setFullRequest(event.target.value)}
            />
          </div>
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">Response details</p>
                <p className="text-sm text-slate-500">Dummy response preview.</p>
              </div>
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300">{request.response.status}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-950/90 p-3 text-sm text-slate-300">
                <p className="text-slate-500">Content-Type</p>
                <p className="mt-1 text-slate-100">{request.response.headers["content-type"] || "n/a"}</p>
              </div>
              <div className="rounded-3xl bg-slate-950/90 p-3 text-sm text-slate-300">
                <p className="text-slate-500">Cache</p>
                <p className="mt-1 text-slate-100">{request.response.headers["cache-control"] || "n/a"}</p>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 p-3 text-sm text-slate-200">
              {request.response.body || "(empty response body)"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
