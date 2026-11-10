import { useEffect, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useServices } from '../../contexts/ServicesContext';
import { ServiceIcon, Skeleton, Alert, Spinner } from '../../components/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ServicesAdmin() {
  const { reload } = useServices();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { api('/api/admin?action=services').then((d) => setRows(d.map((s: any) => ({ ...s, highlightsText: (s.highlights || []).join('\n') })))).catch((e) => setMsg({ kind: 'error', text: e.message })).finally(() => setLoading(false)); }, []);
  const set = (id: number, k: string, v: unknown) => setRows((r) => r.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const save = async (s: any) => {
    setBusy(s.id); setMsg(null);
    try {
      await api('/api/admin?action=services', { method: 'PUT', body: { id: s.id, short_description: s.short_description, description: s.description, highlights: s.highlightsText.split('\n'), is_active: s.is_active } });
      setMsg({ kind: 'success', text: `${s.title} updated.` }); reload();
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-navy">Service Categories</h1>
        <p className="text-sm text-muted">Afrigate’s four service categories. Names are locked to preserve the brand; descriptions and supporting details can be refined.</p>
      </div>
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {loading ? <Skeleton className="h-96" /> : rows.map((s) => (
        <div key={s.id} className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy text-gold"><ServiceIcon icon={s.icon} /></span>
            <div className="flex-1"><div className="flex items-center gap-2 font-display font-bold text-navy">{s.title}<Lock className="h-3.5 w-3.5 text-muted" aria-label="Name locked" /></div><div className="font-mono text-xs text-muted">/services/{s.slug}</div></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.is_active} onChange={(e) => set(s.id, 'is_active', e.target.checked)} className="accent-[#0b2a5b]" />Visible</label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div><label className="label" htmlFor={`sd-${s.id}`}>Short description (shown on cards)</label><input id={`sd-${s.id}`} className="input" value={s.short_description} onChange={(e) => set(s.id, 'short_description', e.target.value)} /></div>
              <div><label className="label" htmlFor={`d-${s.id}`}>Full description</label><textarea id={`d-${s.id}`} rows={5} className="input" value={s.description} onChange={(e) => set(s.id, 'description', e.target.value)} /></div>
            </div>
            <div><label className="label" htmlFor={`h-${s.id}`}>“How we can help” points (one per line)</label><textarea id={`h-${s.id}`} rows={9} className="input" value={s.highlightsText} onChange={(e) => set(s.id, 'highlightsText', e.target.value)} /></div>
          </div>
          <div className="mt-4 flex justify-end"><button onClick={() => save(s)} disabled={busy === s.id} className="btn btn-navy btn-sm">{busy === s.id ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}Save</button></div>
        </div>
      ))}
    </div>
  );
}
