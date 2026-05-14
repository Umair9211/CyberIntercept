"use client";

import { useState } from "react";
import { sendRepeaterRequest } from "@/lib/api";
import { buildRequestText, parseRawHttpMessage } from "@/lib/httpRawRequest";

export default function RequestPanel({ request, onClose }) {
  const [fullRequest, setFullRequest] = useState(() => buildRequestText(request));
  const [sending, setSending] = useState(false);
  const [repeaterResult, setRepeaterResult] = useState(null);
  const [repeaterError, setRepeaterError] = useState(null);

  const handleSendRequest = async () => {
    setRepeaterError(null);
    setRepeaterResult(null);
    let payload;
    try {
      payload = parseRawHttpMessage(fullRequest);
    } catch (err) {
      setRepeaterError(err.message ?? "Could not parse request.");
      return;
    }

    setSending(true);
    try {
      const data = await sendRepeaterRequest(payload);
      setRepeaterResult(data);
    } catch (err) {
      setRepeaterError(err.message ?? "Repeater request failed.");
    } finally {
      setSending(false);
    }
  };

  const handleOpenPayload = () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(request)));
    window.open(`/payload?data=${encodeURIComponent(encoded)}`, "_blank");
  };

  const responseStatusLabel = repeaterResult
    ? String(repeaterResult.status_code ?? "—")
    : String(request.response?.status ?? "—");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-950/95 shadow-2xl">
        <div className="flex h-24 shrink-0 items-center gap-4 border-b border-slate-800/80 bg-slate-900/90 px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Request inspector</p>
            <h2
              className="mt-1 truncate text-xl font-semibold text-slate-100 sm:text-2xl"
              title={`${request.method} ${request.url}`}
            >
              {request.method} {request.url}
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={sending}
              className="rounded-2xl border border-emerald-700/50 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-600 hover:bg-emerald-900/70 disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={handleOpenPayload}
              className="rounded-2xl border border-amber-700/50 bg-amber-950/50 px-4 py-2 text-sm text-amber-300 transition hover:border-amber-600 hover:bg-amber-900/70"
            >
              Payload
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
            >
              Close inspector
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {repeaterError && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {repeaterError}
            </div>
          )}
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">URL</p>
              <p className="mt-3 break-all text-sm text-slate-100" title={request.url}>
                {request.url}
              </p>
            </div>
            <div className="min-w-0 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
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
                <p className="text-sm text-slate-500">Editable request; Send relays via the repeater API.</p>
              </div>
            </div>
            <textarea
              className="mt-4 min-h-[420px] w-full resize-none rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 text-sm text-slate-100 outline-none focus:border-emerald-500/80"
              value={fullRequest}
              onChange={(event) => setFullRequest(event.target.value)}
            />
          </div>
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-100">Response details</p>
                <p className="text-sm text-slate-500">
                  {repeaterResult
                    ? "Repeater response from the backend."
                    : "Send a request to populate this section, or view captured placeholders."}
                </p>
              </div>
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
                {responseStatusLabel}
              </span>
            </div>
            {repeaterResult && (
              <>
                {repeaterResult.error && (
                  <p className="mt-3 text-sm text-amber-300">{repeaterResult.error}</p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Final URL: <span className="text-slate-300">{repeaterResult.url}</span>
                  {" · "}
                  Elapsed:{" "}
                  <span className="text-slate-300">
                    {typeof repeaterResult.elapsed === "number"
                      ? `${repeaterResult.elapsed.toFixed(3)}s`
                      : "—"}
                  </span>
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(repeaterResult.headers || {}).slice(0, 12).map(([key, value]) => (
                    <div key={key} className="rounded-3xl bg-slate-950/90 p-3 text-sm text-slate-300">
                      <p className="truncate text-slate-500" title={key}>
                        {key}
                      </p>
                      <p className="mt-1 break-all text-slate-100">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <pre className="mt-4 overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 p-3 text-sm text-slate-200">
                  {repeaterResult.body || "(empty response body)"}
                </pre>
              </>
            )}
            {!repeaterResult && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-950/90 p-3 text-sm text-slate-300">
                    <p className="text-slate-500">Content-Type</p>
                    <p className="mt-1 text-slate-100">
                      {request.response?.headers?.["content-type"] || "n/a"}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/90 p-3 text-sm text-slate-300">
                    <p className="text-slate-500">Cache</p>
                    <p className="mt-1 text-slate-100">
                      {request.response?.headers?.["cache-control"] || "n/a"}
                    </p>
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 p-3 text-sm text-slate-200">
                  {request.response?.body || "(empty response body)"}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
