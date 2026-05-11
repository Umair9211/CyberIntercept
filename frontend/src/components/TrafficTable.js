function statusStyle(status) {
  if (status >= 200 && status < 300) return "bg-emerald-500/15 text-emerald-300";
  if (status >= 300 && status < 400) return "bg-sky-500/15 text-sky-300";
  if (status >= 400 && status < 500) return "bg-amber-500/15 text-amber-300";
  return "bg-rose-500/15 text-rose-300";
}

const methodStyle = {
  GET: "bg-slate-700 text-slate-100",
  POST: "bg-slate-800 text-slate-100",
  PUT: "bg-slate-800 text-slate-100",
  DELETE: "bg-slate-800 text-slate-100",
  PATCH: "bg-slate-800 text-slate-100",
};

export default function TrafficTable({
  traffic,
  selectedId,
  selectedIds,
  interceptOn,
  onSelectRequest,
  onToggleSelect,
  onSelectAll,
  onForwardSelected,
  onForwardAll,
  onDropSelected,
  onDropAll,
}) {
  const allSelected = traffic.length > 0 && selectedIds?.length === traffic.length;
  const actionDisabled = !selectedIds || selectedIds.length === 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/80 shadow-xl">
      <div className="border-b border-slate-800/80 bg-slate-900/90 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Intercepted traffic</h3>
            <p className="mt-1 text-sm text-slate-500">Traffic captured in the current session.</p>
          </div>
          {interceptOn && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onForwardSelected}
                disabled={actionDisabled}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forward
              </button>
              <button
                type="button"
                onClick={onForwardAll}
                disabled={traffic.length === 0}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forward all
              </button>
              <button
                type="button"
                onClick={onDropSelected}
                disabled={actionDisabled}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Drop
              </button>
              <button
                type="button"
                onClick={onDropAll}
                disabled={traffic.length === 0}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Drop all
              </button>
            </div>
          )}
        </div>
        {interceptOn && (
          <p className="mt-3 text-sm text-slate-400">{selectedIds.length || 0} selected</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              {interceptOn && <th className="px-4 py-4 font-medium w-12" />}
              <th className="px-6 py-4 font-medium">Method</th>
              <th className="px-6 py-4 font-medium">URL</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Time</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {traffic.length === 0 ? (
              <tr className="border-t border-slate-800/80">
                <td colSpan={interceptOn ? 6 : 5} className="px-6 py-16 text-center text-slate-500">
                  No intercepted requests. Use the controls to simulate traffic capture.
                </td>
              </tr>
            ) : (
              traffic.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectRequest(item)}
                  className={`cursor-pointer border-t border-slate-800/80 transition hover:bg-slate-900/70 ${selectedId === item.id ? "bg-slate-900/70" : ""}`}
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
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${methodStyle[item.method] || "bg-slate-700 text-slate-100"}`}>
                      {item.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-200">
                    <div className="max-w-xl truncate">{item.url}</div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-400">{item.time}</td>
                  <td className="px-6 py-4 align-top text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectRequest(item);
                      }}
                      className="rounded-2xl border border-slate-700/80 bg-slate-800/90 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-700"
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
