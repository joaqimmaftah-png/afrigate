import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Skeleton, Alert } from '../../components/ui';
import { fmtDateTime } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ENTITIES = ['', 'consultation', 'document', 'appointment', 'profile', 'service', 'article', 'testimonial', 'enquiry'];

export default function Audit() {
  const [d, setD] = useState<{ items: any[]; total: number; page: number } | null>(null);
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setD(null);
    api(`/api/admin?action=audit&page=${page}${entity ? `&entity=${entity}` : ''}`).then(setD).catch((e) => setErr(e.message));
  }, [page, entity]);
  const pages = d ? Math.max(1, Math.ceil(d.total / 50)) : 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-display text-2xl font-extrabold text-navy">Activity Log</h1><p className="text-sm text-muted">Audit trail of important actions across the platform.</p></div>
        <select className="input sm:w-56" value={entity} onChange={(e) => { setPage(0); setEntity(e.target.value); }} aria-label="Entity filter">{ENTITIES.map((x) => <option key={x} value={x}>{x ? x[0].toUpperCase() + x.slice(1) : 'All entities'}</option>)}</select>
      </div>
      {err && <Alert>{err}</Alert>}
      {!d ? <Skeleton className="h-96" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-canvas/70 text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-5 py-3">When</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-line">
              {d.items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{fmtDateTime(a.created_at)}</td>
                  <td className="px-3 py-3"><div className="font-medium">{a.actor_email}</div><div className="text-xs capitalize text-muted">{a.actor_role}</div></td>
                  <td className="px-3 py-3"><span className="rounded-md bg-navy/5 px-2 py-1 font-mono text-xs text-navy">{a.action}</span></td>
                  <td className="max-w-md truncate px-3 py-3 font-mono text-xs text-muted" title={JSON.stringify(a.details)}>{a.entity}#{a.entity_id} {a.details && Object.keys(a.details).length ? JSON.stringify(a.details) : ''}</td>
                </tr>
              ))}
              {d.items.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-muted">No activity recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted">Page {page + 1} of {pages}</span>
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-ghost btn-sm" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
        <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="btn btn-ghost btn-sm" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
