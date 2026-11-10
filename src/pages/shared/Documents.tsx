import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Download, Search, FolderLock } from 'lucide-react';
import { api, downloadDocument } from '../../lib/api';
import { Skeleton, Alert, EmptyState } from '../../components/ui';
import { fmtDateTime, fmtSize } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Documents({ mode }: { mode: 'customer' | 'staff' }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  useEffect(() => { api('/api/files?action=list').then(setDocs).catch((e) => setErr(e.message)).finally(() => setLoading(false)); }, []);
  const cats = useMemo(() => Array.from(new Set(docs.map((d) => d.category))), [docs]);
  const shown = docs.filter((d) => (!cat || d.category === cat) && (!q || [d.file_name, d.consultation?.reference, d.consultation?.subject].some((v) => v?.toLowerCase().includes(q.toLowerCase()))));
  const base = mode === 'customer' ? '/portal/requests' : '/staff/consultations';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-navy">Documents</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted"><FolderLock className="h-4 w-4" />Stored privately. Download links are generated on demand and expire after two minutes.</p>
      </div>
      <div className="card flex flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search file name or reference…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search documents" /></div>
        <select className="input sm:w-60" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {loading ? <Skeleton className="h-64" /> : shown.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No documents" text={docs.length ? 'No documents match your filters.' : 'Documents you exchange within consultations will appear here.'} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {shown.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${d.is_report ? 'bg-emerald-50 text-emerald-700' : 'bg-navy/5 text-navy'}`}><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{d.file_name}</div>
                  <div className="text-xs text-muted">{d.category} · {fmtSize(d.size_bytes)} · {d.uploader} · {fmtDateTime(d.created_at)}</div>
                </div>
                <Link to={`${base}/${d.consultation_id}`} className="font-mono text-xs text-gold-deep hover:underline">{d.consultation?.reference}</Link>
                <button onClick={() => downloadDocument(d.id).catch((e) => setErr(e.message))} className="btn btn-ghost btn-sm"><Download className="h-4 w-4" />Download</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
