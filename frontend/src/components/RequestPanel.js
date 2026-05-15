"use client";

import { useState } from "react";
import { sendRepeaterRequest } from "@/lib/api";
import { buildRequestText, parseRawHttpMessage } from "@/lib/httpRawRequest";
import { stashPayloadRequest } from "@/lib/payloadTransfer";

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
    const text = buildRequestText(request);
    const id = stashPayloadRequest(text);
    if (id) {
      window.open(`/payload?id=${encodeURIComponent(id)}`, "_blank");
      return;
    }
    window.open("/payload", "_blank");
  };

  const responseStatusLabel = repeaterResult
    ? String(repeaterResult.status_code ?? "—")
    : String(request.response?.status ?? "—");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-slate-950/70 sm:p-6">
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl dark:border-slate-800/90 dark:bg-slate-950/95">
        <div className="flex h-24 shrink-0 items-center gap-4 border-b border-slate-200 bg-slate-100 px-6 py-4 dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">Request inspector</p>
            <h2
              className="mt-1 truncate text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100"
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
              className="rounded-2xl border border-emerald-600/50 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/70"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={handleOpenPayload}
              className="rounded-2xl border border-amber-600/50 bg-amber-50 px-4 py-2 text-sm text-amber-900 transition hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:border-amber-600 dark:hover:bg-amber-900/70"
            >
              Payload
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-950/90 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Close inspector
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {repeaterError && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {repeaterError}
            </div>
          )}
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">URL</p>
              <p className="mt-3 break-all text-sm text-slate-900 dark:text-slate-100" title={request.url}>
                {request.url}
              </p>
            </div>
            <div className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">Metadata</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300">
                <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-transparent dark:bg-slate-950/90">
                  <p className="text-slate-500 dark:text-slate-500">Method</p>
                  <p className="mt-1 text-slate-900 dark:text-slate-100">{request.method}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-transparent dark:bg-slate-950/90">
                  <p className="text-slate-500 dark:text-slate-500">Protocol</p>
                  <p className="mt-1 text-slate-900 dark:text-slate-100">{request.protocol}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-transparent dark:bg-slate-950/90">
                  <p className="text-slate-500 dark:text-slate-500">Status</p>
                  <p className="mt-1 text-slate-900 dark:text-slate-100">{request.status}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-transparent dark:bg-slate-950/90">
                  <p className="text-slate-500 dark:text-slate-500">Time</p>
                  <p className="mt-1 text-slate-900 dark:text-slate-100">{request.time}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Full request</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">Editable request; Send relays via the repeater API.</p>
              </div>
            </div>
            <textarea
              className="mt-4 min-h-[420px] w-full resize-none rounded-3xl border border-slate-300 bg-white p-4 text-sm text-slate-900 outline-none focus:border-emerald-500/60 dark:border-slate-800/80 dark:bg-slate-950/90 dark:text-slate-100 dark:focus:border-emerald-500/80"
              value={fullRequest}
              onChange={(event) => setFullRequest(event.target.value)}
            />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Response details</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  {repeaterResult
                    ? "Repeater response from the backend."
                    : "Send a request to populate this section, or view captured placeholders."}
                </p>
              </div>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                {responseStatusLabel}
              </span>
            </div>
            {repeaterResult && (
              <>
                {repeaterResult.error && (
                  <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">{repeaterResult.error}</p>
                )}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                  Final URL: <span className="text-slate-800 dark:text-slate-300">{repeaterResult.url}</span>
                  {" · "}
                  Elapsed:{" "}
                  <span className="text-slate-800 dark:text-slate-300">
                    {typeof repeaterResult.elapsed === "number"
                      ? `${repeaterResult.elapsed.toFixed(3)}s`
                      : "—"}
                  </span>
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(repeaterResult.headers || {}).slice(0, 12).map(([key, value]) => (
                    <div key={key} className="rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-transparent dark:bg-slate-950/90 dark:text-slate-300">
                      <p className="truncate text-slate-500 dark:text-slate-500" title={key}>
                        {key}
                      </p>
                      <p className="mt-1 break-all text-slate-900 dark:text-slate-100">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <pre className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-800 dark:border-slate-800/80 dark:bg-slate-950/90 dark:text-slate-200">
                  {repeaterResult.body || "(empty response body)"}
                </pre>
              </>
            )}
            {!repeaterResult && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-transparent dark:bg-slate-950/90 dark:text-slate-300">
                    <p className="text-slate-500 dark:text-slate-500">Content-Type</p>
                    <p className="mt-1 text-slate-900 dark:text-slate-100">
                      {request.response?.headers?.["content-type"] || "n/a"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-transparent dark:bg-slate-950/90 dark:text-slate-300">
                    <p className="text-slate-500 dark:text-slate-500">Cache</p>
                    <p className="mt-1 text-slate-900 dark:text-slate-100">
                      {request.response?.headers?.["cache-control"] || "n/a"}
                    </p>
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-800 dark:border-slate-800/80 dark:bg-slate-950/90 dark:text-slate-200">
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
