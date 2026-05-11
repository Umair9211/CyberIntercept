"use client";

import { useMemo, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import TrafficTable from "@/components/TrafficTable";
import RequestPanel from "@/components/RequestPanel";
import { trafficData as initialTrafficData } from "@/lib/mockData";

export default function Home() {
  const [traffic, setTraffic] = useState(initialTrafficData);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [interceptOn, setInterceptOn] = useState(false);
  const [captureOn, setCaptureOn] = useState(false);

  const stats = useMemo(
    () => ({
      total: traffic.length,
      successful: traffic.filter((item) => item.status >= 200 && item.status < 300).length,
      errors: traffic.filter((item) => item.status >= 400).length,
    }),
    [traffic]
  );

  const handleClearTraffic = () => {
    setTraffic([]);
    setSelectedRequest(null);
    setSelectedIds([]);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === traffic.length ? [] : traffic.map((item) => item.id)
    );
  };

  const handleForwardSelected = () => {
    setTraffic((current) => current.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  const handleDropSelected = () => {
    setTraffic((current) => current.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  const handleForwardAll = () => {
    setTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  const handleDropAll = () => {
    setTraffic([]);
    setSelectedIds([]);
    setSelectedRequest(null);
  };

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">CyberIntercept</p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-100">Traffic dashboard</h1>
        </div>
      

        <div className="mx-auto max-w-[1600px] px-0 py-6 sm:px-0 lg:px-0">
            <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live dashboard</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-100">Intercepted traffic</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                      This UI simulates an interception dashboard with request inspection and capture controls.
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
                    Monitoring active traffic
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-950/90 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Captured</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-100">{stats.total}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/90 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Successful</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-300">{stats.successful}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/90 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Alerts</p>
                    <p className="mt-3 text-3xl font-semibold text-amber-300">{stats.errors}</p>
                  </div>
                </div>
              </div>

              <ControlPanel
                interceptOn={interceptOn}
                captureOn={captureOn}
                onToggleIntercept={() => setInterceptOn((current) => !current)}
                onToggleCapture={() => setCaptureOn((current) => !current)}
                onClearTraffic={handleClearTraffic}
              />
            </section>

            <section className="mt-6">
              <TrafficTable
                traffic={traffic}
                selectedId={selectedRequest?.id}
                selectedIds={selectedIds}
                interceptOn={interceptOn}
                onSelectRequest={handleSelectRequest}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onForwardSelected={handleForwardSelected}
                onForwardAll={handleForwardAll}
                onDropSelected={handleDropSelected}
                onDropAll={handleDropAll}
              />
            </section>
            <RequestPanel request={selectedRequest} onClose={() => setSelectedRequest(null)} />
          </div>
        </main>
      </div>
  );
}
