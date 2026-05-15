"use client";

import { useEffect, useRef } from "react";

function statusStyle(status) {
  if (typeof status !== "number" || Number.isNaN(status)) {
    return "bg-slate-500/15 text-slate-600 dark:bg-slate-600/20 dark:text-slate-300";
  }
  if (status >= 200 && status < 300) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status >= 300 && status < 400) return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (status >= 400 && status < 500) return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  if (status === 0) return "bg-slate-500/15 text-slate-600 dark:bg-slate-600/20 dark:text-slate-300";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

const methodStyle = {
  GET: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  POST: "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  PUT: "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  DELETE: "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  PATCH: "bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
};

export default function TrafficTable({
  traffic,
  selectedId,
  selectedIds,
  interceptOn,
  onSelectRequest,
  onToggleSelect,
  onForwardSelected,
  onForwardAll,
  onDropSelected,
  onDropAll,
  onClearTraffic,
}) {
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [traffic]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = 40;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= nearBottom;
  };

  const actionDisabled = !selectedIds || selectedIds.length === 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Intercepted traffic</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
              Traffic captured in the current session.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {interceptOn && (
              <>
                <button
                  type="button"
                  onClick={onForwardSelected}
                  disabled={actionDisabled}
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
                >
                  Forward
                </button>
                <button
                  type="button"
                  onClick={onForwardAll}
                  disabled={traffic.length === 0}
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
                >
                  Forward all
                </button>
                <button
                  type="button"
                  onClick={onDropSelected}
                  disabled={actionDisabled}
                  className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-200"
                >
                  Drop
                </button>
                <button
                  type="button"
                  onClick={onDropAll}
                  disabled={traffic.length === 0}
                  className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-200"
                >
                  Drop all
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClearTraffic}
              className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
            >
              Clear traffic
            </button>
          </div>
        </div>
        {interceptOn && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{selectedIds.length || 0} selected</p>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[480px] overflow-y-auto overflow-x-auto"
      >
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-100 text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
            <tr>
              {interceptOn && <th className="w-12 px-4 py-4 font-medium" />}
              <th className="px-6 py-4 font-medium">Method</th>
              <th className="px-6 py-4 font-medium">URL</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Time</th>
              <th className="px-6 py-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {traffic.length === 0 ? (
              <tr className="border-t border-slate-200 dark:border-slate-800/80">
                <td
                  colSpan={interceptOn ? 6 : 5}
                  className="px-6 py-16 text-center text-slate-500 dark:text-slate-500"
                >
                  No intercepted requests. Use the controls to simulate traffic capture.
                </td>
              </tr>
            ) : (
              traffic.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectRequest(item)}
                  className={`cursor-pointer border-t border-slate-200 transition hover:bg-slate-100 dark:border-slate-800/80 dark:hover:bg-slate-900/70 ${selectedId === item.id ? "bg-slate-100 dark:bg-slate-900/70" : ""}`}
                >
                  {interceptOn && (
                    <td className="px-4 py-4 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelect(item.id);
                        }}
                        className="h-4 w-4 rounded border-slate-400 bg-white text-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-400"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${methodStyle[item.method] || "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"}`}
                    >
                      {item.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-800 dark:text-slate-200">
                    <div className="max-w-xl truncate">{item.url}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-500 dark:text-slate-400">{item.time}</td>
                  <td className="px-6 py-4 align-top text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectRequest(item);
                      }}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
