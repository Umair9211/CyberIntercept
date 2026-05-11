export default function ControlPanel({ interceptOn, captureOn, onToggleIntercept, onToggleCapture, onClearTraffic }) {
  return (
    <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-xl sm:max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Intercept Control</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">Session controls</h2>
        </div>
        <button
          type="button"
          onClick={onClearTraffic}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
        >
          Clear traffic
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Capture mode</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">{captureOn ? "ON" : "OFF"}</p>
            </div>
            <button
              type="button"
              onClick={onToggleCapture}
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition ${
                captureOn ? "bg-emerald-500/90" : "bg-slate-700"
              }`}
            >
              <span className={`inline-block h-6 w-6 rounded-full bg-slate-950 transition ${captureOn ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Enable/disable traffic capture.</p>
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Intercept</p>
              <p className="mt-1 text-xl font-semibold text-slate-100">{interceptOn ? "ON" : "OFF"}</p>
            </div>
            <button
              type="button"
              onClick={onToggleIntercept}
              className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition ${
                interceptOn ? "bg-emerald-500/90" : "bg-slate-700"
              }`}
            >
              <span className={`inline-block h-6 w-6 rounded-full bg-slate-950 transition ${interceptOn ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Toggle intercepted request capture.</p>
        </div>
      </div>
    </section>
  );
}
