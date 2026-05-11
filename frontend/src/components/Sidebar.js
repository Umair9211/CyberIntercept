export default function Sidebar() {
  return (
    <aside className="hidden h-screen w-80 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/95 px-6 py-8 lg:flex">
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20">
              CI
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">CyberIntercept</p>
              <p className="text-xs text-slate-500">Traffic interception UI</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5 text-sm text-slate-400">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Inspector</p>
        <p className="mt-3 leading-6 text-slate-300">
          Select a request to inspect the full payload in a layered overlay.
        </p>
      </div>
    </aside>
  );
}
