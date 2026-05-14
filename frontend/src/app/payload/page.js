"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sendRepeaterRequest } from "@/lib/api";
import { buildRequestText, parseRawHttpMessage } from "@/lib/httpRawRequest";

const DEFAULT_REQUEST = `GET /example HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: text/html

username=user&password=changeme`;

/** Max word-list file size: only files strictly smaller than 50 MiB are accepted. */
const MAX_WORDLIST_FILE_BYTES = 50 * 1024 * 1024;

function isLikelyTextFile(file) {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("text/")) return true;
  if (t === "application/json" || t === "application/xml" || t === "application/x-ndjson") return true;
  if (/\.(txt|csv|lst|log|md|tsv|dict)$/i.test(file.name)) return true;
  if (t === "" || t === "application/octet-stream") {
    return /\.(txt|csv|lst|log|md|tsv|dict)$/i.test(file.name);
  }
  return false;
}

function mapCaretAfterUnwrap(pos, matchStart, matchEnd) {
  let p = pos;
  if (p > matchStart) p -= 1;
  if (p >= matchEnd) p -= 1;
  return Math.max(0, p);
}

function statusClass(code) {
  if (typeof code !== "number" || Number.isNaN(code)) return "text-slate-400";
  if (code >= 200 && code < 300) return "text-emerald-300";
  if (code >= 300 && code < 400) return "text-sky-300";
  if (code >= 400 && code < 500) return "text-amber-300";
  if (code >= 500) return "text-rose-300";
  return "text-slate-300";
}

function statusBadgeClass(code) {
  if (typeof code !== "number" || Number.isNaN(code)) return "bg-slate-700/30 text-slate-300";
  if (code >= 200 && code < 300) return "bg-emerald-500/15 text-emerald-300";
  if (code >= 300 && code < 400) return "bg-sky-500/15 text-sky-300";
  if (code >= 400 && code < 500) return "bg-amber-500/15 text-amber-300";
  if (code >= 500) return "bg-rose-500/15 text-rose-300";
  return "bg-slate-700/30 text-slate-300";
}

function statusSortValue(row) {
  return row.error ? 100_000 : (row.status_code ?? 0);
}

export default function PayloadPage() {
  const requestRef = useRef(null);
  const wordListFileRef = useRef(null);
  const [requestText, setRequestText] = useState(DEFAULT_REQUEST);
  const [wordListText, setWordListText] = useState("");
  const [wordListFileName, setWordListFileName] = useState("");
  const [wordListFileError, setWordListFileError] = useState("");
  const [delayMs, setDelayMs] = useState(0);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  /** null = not used; combined: status first, then preview within equal status */
  const [resultsStatusDir, setResultsStatusDir] = useState(null);
  const [resultsPreviewDir, setResultsPreviewDir] = useState(null);
  const isCancelled = useRef(false);
  const resultsScrollRef = useRef(null);
  const resultsStickBottomRef = useRef(true);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("data");
      if (!raw) return;
      const request = JSON.parse(decodeURIComponent(atob(raw)));
      setRequestText(buildRequestText(request));
    } catch {
      // Invalid or missing payload query — keep default template
    }
  }, []);

  const words = wordListText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const markerMatch = requestText.match(/§([^§]*)§/);
  const hasInjection = markerMatch && markerMatch[1].length > 0;
  const placeholderLabel = markerMatch?.[1] ? `§${markerMatch[1]}§` : "None (select text and click Mark §)";

  const handleMarkSection = useCallback(() => {
    const ta = requestRef.current;
    if (!ta) return;

    let t = requestText;
    let s = ta.selectionStart;
    let e = ta.selectionEnd;

    const m = /§([^§]*)§/.exec(t);
    if (m) {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      t = t.replace(/§([^§]*)§/, "$1");
      s = mapCaretAfterUnwrap(s, matchStart, matchEnd);
      e = mapCaretAfterUnwrap(e, matchStart, matchEnd);
    }

    if (s === e || e > t.length || s < 0) return;
    const selected = t.slice(s, e);
    if (!selected) return;

    const next = `${t.slice(0, s)}§${selected}§${t.slice(e)}`;
    setRequestText(next);
  }, [requestText]);

  const handleStop = () => {
    isCancelled.current = true;
  };

  const handleSendPayload = async () => {
    if (!hasInjection || words.length === 0) return;

    isCancelled.current = false;
    setSending(true);
    setProgress({ current: 0, total: words.length });

    for (let i = 0; i < words.length; i += 1) {
      if (isCancelled.current) break;

      const word = words[i];
      setProgress({ current: i + 1, total: words.length });

      const filled = requestText.replace(/§([^§]*)§/, word);
      const id = `${Date.now()}-${i}`;

      try {
        const payload = parseRawHttpMessage(filled);
        const data = await sendRepeaterRequest(payload);
        const bodyStr = data.body != null ? String(data.body) : "";
        const elapsedMs =
          typeof data.elapsed === "number" ? Math.round(data.elapsed * 1000) : 0;
        const code = typeof data.status_code === "number" ? data.status_code : 0;

        setResults((prev) => [
          ...prev,
          {
            id,
            word,
            status_code: code,
            elapsedMs,
            preview: bodyStr.slice(0, 120),
            fullBody: bodyStr,
            error: data.error ?? null,
          },
        ]);
      } catch (err) {
        setResults((prev) => [
          ...prev,
          {
            id,
            word,
            status_code: 0,
            elapsedMs: 0,
            preview: "",
            fullBody: "",
            error: err.message ?? "Request failed",
          },
        ]);
      }

      if (delayMs > 0 && i < words.length - 1 && !isCancelled.current) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    setSending(false);
    setProgress({ current: 0, total: 0 });
  };

  useEffect(() => {
    const el = resultsScrollRef.current;
    if (!el || results.length === 0) return;
    if (!resultsStickBottomRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [results, expandedId]);

  const handleResultsScroll = () => {
    const el = resultsScrollRef.current;
    if (!el) return;
    const nearBottom = 48;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    resultsStickBottomRef.current = dist <= nearBottom;
  };

  const markEnabled = () => {
    const ta = requestRef.current;
    if (!ta) return false;
    return ta.selectionStart !== ta.selectionEnd;
  };

  const [, force] = useState(0);
  const onSelectRequest = () => force((n) => n + 1);

  const handleWordListFile = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setWordListFileError("");
    if (file.size >= MAX_WORDLIST_FILE_BYTES) {
      setWordListFileError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Must be under 50 MB.`
      );
      return;
    }
    if (!isLikelyTextFile(file)) {
      setWordListFileError("Choose a text-based file (e.g. .txt, .csv) or a file with a text/* type.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setWordListText(text);
      setWordListFileName(file.name);
    };
    reader.onerror = () => {
      setWordListFileError("Could not read that file.");
      setWordListFileName("");
    };
    reader.readAsText(file);
  }, []);

  const canSend = hasInjection && words.length > 0 && !sending;
  const n = words.length;

  const sortedResults = useMemo(() => {
    if (resultsStatusDir === null && resultsPreviewDir === null) return results;
    const copy = [...results];
    copy.sort((a, b) => {
      if (resultsStatusDir !== null) {
        const va = statusSortValue(a);
        const vb = statusSortValue(b);
        const sd = resultsStatusDir === "asc" ? va - vb : vb - va;
        if (sd !== 0) return sd;
      }
      if (resultsPreviewDir !== null) {
        const pa = (a.preview || "").toLowerCase();
        const pb = (b.preview || "").toLowerCase();
        let pd = pa.localeCompare(pb, undefined, { numeric: true, sensitivity: "base" });
        if (pd === 0) pd = String(a.id).localeCompare(String(b.id));
        if (pd !== 0) return resultsPreviewDir === "asc" ? pd : -pd;
      }
      return String(a.id).localeCompare(String(b.id));
    });
    return copy;
  }, [results, resultsStatusDir, resultsPreviewDir]);

  const toggleResultsSortByStatus = useCallback(() => {
    setResultsStatusDir((d) => (d === null ? "asc" : d === "asc" ? "desc" : null));
  }, []);

  const toggleResultsSortByPreview = useCallback(() => {
    setResultsPreviewDir((d) => (d === null ? "asc" : d === "asc" ? "desc" : null));
  }, []);

  const handleClearResults = useCallback(() => {
    setResults([]);
    setExpandedId(null);
    setResultsStatusDir(null);
    setResultsPreviewDir(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">CyberIntercept</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">Payload / Intruder</h1>
            <p className="mt-2 text-sm text-slate-400">
              Mark an injection point with §, load a word list, send sequentially via the repeater API.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Request editor</h2>
              <p className="text-sm text-slate-500">
                Highlight a value, then <span className="text-amber-300/90">Mark §</span> wraps it as{" "}
                <code className="text-slate-300">§payload§</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkSection}
              disabled={!markEnabled()}
              className="rounded-2xl border border-amber-700/50 bg-amber-950/50 px-4 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-600 hover:bg-amber-900/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark §
            </button>
          </div>
          <textarea
            ref={requestRef}
            id="payload-request-editor"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            onSelect={onSelectRequest}
            onKeyUp={onSelectRequest}
            onMouseUp={onSelectRequest}
            className="mt-4 max-h-[min(38vh,320px)] min-h-[160px] w-full resize-y overflow-y-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            spellCheck={false}
          />
          <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
            <span className="text-slate-500">Injection placeholder: </span>
            <span className="font-mono text-slate-200">{placeholderLabel}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Word list</h2>
            <p className="mt-1 text-sm text-slate-500">One word per line. Empty lines are skipped.</p>

            <input
              ref={wordListFileRef}
              type="file"
              accept=".txt,.csv,.lst,.log,.md,.tsv,.dict,text/plain,text/*,application/json"
              className="hidden"
              onChange={handleWordListFile}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={sending}
                onClick={() => wordListFileRef.current?.click()}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/90 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Load from text file…
              </button>
              <span className="text-xs text-slate-500">Text files only; must be under 50 MB.</span>
            </div>
            {wordListFileName && (
              <p className="mt-2 text-xs text-emerald-400/90">Loaded: {wordListFileName}</p>
            )}
            {wordListFileError && (
              <p className="mt-2 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                {wordListFileError}
              </p>
            )}

            <textarea
              value={wordListText}
              onChange={(e) => {
                setWordListText(e.target.value);
                setWordListFileName("");
                setWordListFileError("");
              }}
              className="mt-4 max-h-[min(32vh,280px)] min-h-[120px] w-full resize-y overflow-y-auto rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              placeholder={"admin\npassword123\n…"}
              spellCheck={false}
            />
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
            <div>
              <label htmlFor="delay-ms" className="text-sm font-medium text-slate-300">
                Delay between requests (ms)
              </label>
              <input
                id="delay-ms"
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="mt-2 w-full rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </div>

            {sending && progress.total > 0 && (
              <p className="text-sm text-emerald-300">
                Sending {progress.current} / {progress.total}…
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendPayload}
                disabled={!canSend}
                className="rounded-2xl border border-emerald-700/50 bg-emerald-950/50 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-600 hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send ({n} requests)
              </button>
              {sending && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-2xl border border-rose-700/50 bg-rose-950/50 px-5 py-2.5 text-sm font-medium text-rose-300 transition hover:border-rose-600 hover:bg-rose-900/70"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="flex min-h-0 flex-col rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Results</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Click a row to expand the full response body. Table auto-scrolls to new rows unless you scroll up.
                  Use <span className="text-slate-400">Status</span> for primary order (asc → desc → off), then{" "}
                  <span className="text-slate-400">Response preview</span> to sort within the same status (or preview
                  only if status is off). Each header cycles its own direction.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearResults}
                className="shrink-0 rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2 text-sm font-medium text-rose-200 transition hover:border-rose-500/60 hover:bg-rose-900/50"
              >
                Clear results
              </button>
            </div>
            <div
              ref={resultsScrollRef}
              onScroll={handleResultsScroll}
              className="mt-4 max-h-[min(42vh,380px)] min-h-0 overflow-y-auto overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/70"
            >
              <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-left text-sm">
                <colgroup>
                  <col style={{ width: "3rem" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "5.5rem" }} />
                  <col style={{ width: "auto" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/95 text-slate-400 shadow-[0_1px_0_0_rgb(15_23_42_/_0.8)]">
                  <tr>
                    <th className="px-3 py-3 font-medium">#</th>
                    <th className="px-3 py-3 font-medium">Word</th>
                    <th className="px-3 py-3 font-medium">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleResultsSortByStatus();
                        }}
                        className={`group inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-left font-medium transition hover:bg-slate-800/80 hover:text-slate-200 ${
                          resultsStatusDir !== null ? "text-emerald-300" : ""
                        }`}
                        title="Primary sort: HTTP status (asc → desc → off). Response preview sorts within the same status when both are on."
                      >
                        Status
                        {resultsStatusDir !== null && (
                          <span className="text-emerald-400/90" aria-hidden>
                            {resultsStatusDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Time (ms)</th>
                    <th className="px-3 py-3 font-medium">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleResultsSortByPreview();
                        }}
                        className={`group inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-left font-medium transition hover:bg-slate-800/80 hover:text-slate-200 ${
                          resultsPreviewDir !== null ? "text-emerald-300" : ""
                        }`}
                        title="Secondary sort by preview when status sort is on; otherwise primary by preview only."
                      >
                        Response preview
                        {resultsPreviewDir !== null && (
                          <span className="text-emerald-400/90" aria-hidden>
                            {resultsPreviewDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((row, index) => (
                    <ResultRowGroup
                      key={row.id}
                      row={row}
                      index={index}
                      expanded={expandedId === row.id}
                      onToggle={() =>
                        setExpandedId((cur) => (cur === row.id ? null : row.id))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRowGroup({ row, index, expanded, onToggle }) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-900/80"
        onClick={onToggle}
      >
        <td className="px-3 py-3 align-top text-slate-500">{index + 1}</td>
        <td className="max-w-0 px-3 py-3 align-top font-mono text-slate-200">
          <div className="truncate" title={row.word}>
            {row.word}
          </div>
        </td>
        <td className="max-w-0 px-3 py-3 align-top">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center">
            <span
              className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status_code)}`}
            >
              {row.error ? "ERR" : row.status_code}
            </span>
            {row.error && (
              <span className={`min-w-0 truncate text-xs ${statusClass(row.status_code)}`} title={row.error}>
                {row.error}
              </span>
            )}
          </div>
        </td>
        <td className={`px-3 py-3 align-top tabular-nums ${statusClass(row.status_code)}`}>{row.elapsedMs}</td>
        <td className="max-w-0 px-3 py-3 align-top text-slate-400">
          <div className="truncate" title={row.preview || undefined}>
            {row.preview || "—"}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-800/60 bg-slate-950/50">
          <td colSpan={5} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Full response body</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 text-xs text-slate-200">
              {row.error ? row.error : row.fullBody || "(empty)"}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
