import { useEffect, useState } from 'react';
import { Inbox, Mail, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { Skeleton, Alert, EmptyState } from '../../components/ui';
import { fmtDateTime } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TONE: Record<string, string> = { New: 'bg-gold-soft text-gold-deep', Contacted: 'bg-sky-50 text-sky-800', Resolved: 'bg-emerald-50 text-emerald-700' };

export default function Enquiries() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const load = () => api('/api/admin?action=enquiries').then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const setStatus = async (id: number, status: string) => { try { await api('/api/admin?action=enquiries', { method: 'PUT', body: { id, status } }); load(); } catch (e) { setErr((e as Error).message); } };
  const shown = filter ? rows.filter((r) => r.status === filter) : rows;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-display text-2xl font-extrabold text-navy">Website Enquiries</h1><p className="text-sm text-muted">Messages submitted through the public Contact page.</p></div>
        <select className="input sm:w-48" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter"><option value="">All</option><option>New</option><option>Contacted</option><option>Resolved</option></select>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {loading ? <Skeleton className="h-64" /> : shown.length === 0 ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="No enquiries" text="New contact form submissions will appear here." /> : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{r.name}{r.company && <span className="font-normal text-muted"> · {r.company}</span>}</div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted">
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-navy"><Mail className="h-3.5 w-3.5" />{r.email}</a>
                    {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:text-navy"><Phone className="h-3.5 w-3.5" />{r.phone}</a>}
                    <span>{fmtDateTime(r.created_at)}</span>
                  </div>
                </div>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={`rounded-full border-0 px-3 py-1 text-xs font-semibold ${TONE[r.status]}`} aria-label="Status"><option>New</option><option>Contacted</option><option>Resolved</option></select>
              </div>
              {r.service && <div className="mt-2 text-xs font-semibold text-gold-deep">{r.service}</div>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
