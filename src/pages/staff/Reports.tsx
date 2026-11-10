import { useEffect, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { Skeleton, Alert, StatCard } from '../../components/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[minmax(0,1fr)_2fr_36px] items-center gap-3 text-sm">
          <span className="truncate text-muted" title={d.label}>{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-canvas"><span className="block h-full rounded-full bg-navy" style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="text-right font-semibold">{d.value}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-muted">No data in range.</p>}
    </div>
  );
}

export default function Reports() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 180 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api(`/api/admin?action=reports&from=${from}&to=${to}`).then(setD).catch((e) => setErr(e.message)).finally(() => setLoading(false)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const exportCsv = () => {
    if (!d) return;
    const lines = [['Section', 'Label', 'Value']];
    Object.entries(d.totals).forEach(([k, v]) => lines.push(['Totals', k, String(v ?? '')]));
    d.byStatus.forEach((x: any) => lines.push(['By status', x.label, x.value]));
    d.byService.forEach((x: any) => lines.push(['By service', x.label, x.value]));
    d.byMonth.forEach((x: any) => lines.push(['By month (submitted/completed)', x.month, `${x.submitted}/${x.completed}`]));
    d.consultants.forEach((x: any) => lines.push(['Consultant (assigned/active/completed)', x.name, `${x.assigned}/${x.active}/${x.completed}`]));
    d.appointmentMethods.forEach((x: any) => lines.push(['Appointments by method', x.label, x.value]));
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `afrigate-report-${from}-to-${to}.csv`;
    a.click();
  };

  const maxMonth = Math.max(1, ...(d?.byMonth || []).map((m: any) => m.submitted));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="font-display text-2xl font-extrabold text-navy">Operational Reports</h1><p className="text-sm text-muted">Consultation volumes, service demand, turnaround and consultant performance.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="rf">From</label><input id="rf" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label" htmlFor="rt">To</label><input id="rt" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button onClick={load} className="btn btn-navy">Apply</button>
          <button onClick={exportCsv} disabled={!d} className="btn btn-ghost"><Download className="h-4 w-4" />CSV</button>
        </div>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {loading || !d ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Consultations" value={d.totals.consultations} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="Open" value={d.totals.open} icon={<BarChart3 className="h-5 w-5" />} tone="gold" />
            <StatCard label="Completed/closed" value={d.totals.completed} icon={<BarChart3 className="h-5 w-5" />} tone="green" />
            <StatCard label="Avg. days to complete" value={d.totals.avg_days_to_complete ?? '—'} icon={<BarChart3 className="h-5 w-5" />} tone="amber" />
            <StatCard label="Appointments" value={d.totals.appointments} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label="Web enquiries" value={d.totals.enquiries} icon={<BarChart3 className="h-5 w-5" />} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 font-display font-bold text-navy">Monthly volume</h2>
            {d.byMonth.length === 0 ? <p className="text-sm text-muted">No data in range.</p> : (
              <div className="flex h-48 items-end gap-3 overflow-x-auto pb-1">
                {d.byMonth.map((m: any) => (
                  <div key={m.month} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
                    <div className="flex h-40 w-full items-end justify-center gap-1">
                      <div className="w-1/2 rounded-t bg-navy" style={{ height: `${(m.submitted / maxMonth) * 100}%` }} title={`${m.submitted} submitted`} />
                      <div className="w-1/2 rounded-t bg-gold" style={{ height: `${(m.completed / maxMonth) * 100}%` }} title={`${m.completed} completed`} />
                    </div>
                    <span className="text-[11px] text-muted">{m.month.slice(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-navy" />Submitted</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-gold" />Completed</span></div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5"><h2 className="mb-4 font-display font-bold text-navy">By service</h2><Bars data={d.byService} /></div>
            <div className="card p-5"><h2 className="mb-4 font-display font-bold text-navy">By status</h2><Bars data={d.byStatus} /></div>
            <div className="card p-5"><h2 className="mb-4 font-display font-bold text-navy">Appointments by method</h2><Bars data={d.appointmentMethods} /></div>
            <div className="card overflow-x-auto p-5">
              <h2 className="mb-4 font-display font-bold text-navy">Consultant performance</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr><th className="pb-2">Consultant</th><th className="pb-2 text-right">Assigned</th><th className="pb-2 text-right">Active</th><th className="pb-2 text-right">Completed</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.consultants.map((c: any) => <tr key={c.name}><td className="py-2 font-medium">{c.name}</td><td className="py-2 text-right">{c.assigned}</td><td className="py-2 text-right">{c.active}</td><td className="py-2 text-right">{c.completed}</td></tr>)}
                  {d.consultants.length === 0 && <tr><td colSpan={4} className="py-3 text-muted">No assignments in range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
