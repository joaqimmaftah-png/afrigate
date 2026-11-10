import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Quote } from 'lucide-react';
import { api } from '../../lib/api';
import { Skeleton, Alert, Modal, Field, Spinner, EmptyState } from '../../components/ui';
import { fmtDate } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
const blank = { id: 0, title: '', excerpt: '', body: '', category: 'news', tag: '', published: true, source_url: '' };

export default function Content() {
  const [tab, setTab] = useState<'articles' | 'testimonials'>('articles');
  const [articles, setArticles] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState({ name: '', company: '', quote: '', approved: true, confirmed: false });
  const [tOpen, setTOpen] = useState(false);

  const load = () => Promise.all([api('/api/admin?action=articles'), api('/api/admin?action=testimonials')]).then(([a, b]) => { setArticles(a); setTests(b); }).catch((e) => setMsg({ kind: 'error', text: e.message })).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const saveArticle = async () => {
    const e: Record<string, string> = {};
    if (edit.title.trim().length < 5) e.title = 'At least 5 characters.';
    if (edit.body.trim().length < 20) e.body = 'At least 20 characters.';
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api('/api/admin?action=articles', { method: edit.id ? 'PUT' : 'POST', body: edit }); setEdit(null); setMsg({ kind: 'success', text: 'Article saved.' }); await load(); }
    catch (er) { setMsg({ kind: 'error', text: (er as Error).message }); } finally { setBusy(false); }
  };
  const del = async (id: number) => { if (!confirm('Delete this article permanently?')) return; try { await api('/api/admin?action=articles', { method: 'DELETE', body: { id } }); setMsg({ kind: 'success', text: 'Article deleted.' }); load(); } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } };
  const togglePub = async (a: any) => { try { await api('/api/admin?action=articles', { method: 'PUT', body: { ...a, published: !a.published } }); load(); } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } };

  const saveT = async () => {
    setBusy(true);
    try { await api('/api/admin?action=testimonials', { method: 'POST', body: t }); setTOpen(false); setT({ name: '', company: '', quote: '', approved: true, confirmed: false }); setMsg({ kind: 'success', text: 'Testimonial added.' }); load(); }
    catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-display text-2xl font-extrabold text-navy">News & Content</h1><p className="text-sm text-muted">Publish News & Updates and Tax Information guides, and manage verified client testimonials.</p></div>
        {tab === 'articles' ? <button onClick={() => { setErrs({}); setEdit({ ...blank }); }} className="btn btn-gold w-fit"><Plus className="h-4 w-4" />New article</button> : <button onClick={() => setTOpen(true)} className="btn btn-gold w-fit"><Plus className="h-4 w-4" />Add testimonial</button>}
      </div>
      <div className="inline-flex rounded-xl bg-white p-1">{(['articles', 'testimonials'] as const).map((x) => <button key={x} onClick={() => setTab(x)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === x ? 'bg-navy text-white' : 'text-muted'}`}>{x}</button>)}</div>
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {loading ? <Skeleton className="h-72" /> : tab === 'articles' ? (
        <div className="card divide-y divide-line">
          {articles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.category === 'tax' ? 'bg-gold-soft text-gold-deep' : 'bg-navy/5 text-navy'}`}>{a.category === 'tax' ? 'Tax info' : 'News'}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{a.title}</div><div className="text-xs text-muted">{a.tag || 'No tag'} · {fmtDate(a.published_at)}</div></div>
              <button onClick={() => togglePub(a)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${a.published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{a.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{a.published ? 'Published' : 'Draft'}</button>
              <button onClick={() => { setErrs({}); setEdit({ ...a, tag: a.tag || '', source_url: a.source_url || '' }); }} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-navy" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(a.id)} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {articles.length === 0 && <p className="p-6 text-sm text-muted">No articles yet.</p>}
        </div>
      ) : tests.length === 0 ? (
        <EmptyState icon={<Quote className="h-5 w-5" />} title="No testimonials" text="Only add genuine testimonials that clients have permitted Afrigate to publish. The homepage section stays hidden until at least one is approved." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((x) => (
            <div key={x.id} className="card p-5">
              <p className="text-sm">“{x.quote}”</p>
              <p className="mt-2 text-sm font-semibold text-navy">{x.name}{x.company && <span className="font-normal text-muted"> · {x.company}</span>}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={async () => { await api('/api/admin?action=testimonials', { method: 'PUT', body: { id: x.id, approved: !x.approved } }).catch(() => {}); load(); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${x.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{x.approved ? 'Shown on website' : 'Hidden'}</button>
                <button onClick={async () => { if (confirm('Delete testimonial?')) { await api('/api/admin?action=testimonials', { method: 'DELETE', body: { id: x.id } }).catch(() => {}); load(); } }} className="rounded-full px-3 py-1 text-xs font-semibold text-danger hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit article' : 'New article'} wide>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Section" htmlFor="a-c"><select id="a-c" className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}><option value="news">News & Updates</option><option value="tax">Tax Information</option></select></Field>
              <Field label="Tag" htmlFor="a-t"><input id="a-t" className="input" placeholder="e.g. VAT, Customs" value={edit.tag} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} /></Field>
            </div>
            <Field label="Title *" error={errs.title} htmlFor="a-ti"><input id="a-ti" className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Summary" htmlFor="a-ex"><textarea id="a-ex" rows={2} className="input" value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} /></Field>
            <Field label="Body *" error={errs.body} hint="Separate paragraphs with a blank line. Start a line with '### ' for a heading, '- ' for bullet points." htmlFor="a-b"><textarea id="a-b" rows={10} className="input font-mono text-sm" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            <Field label="Source URL (optional)" htmlFor="a-s"><input id="a-s" className="input" value={edit.source_url} onChange={(e) => setEdit({ ...edit, source_url: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} className="accent-[#0b2a5b]" />Publish on the website</label>
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-navy" disabled={busy} onClick={saveArticle}>{busy && <Spinner className="h-4 w-4" />}Save article</button></div>
          </div>
        )}
      </Modal>

      <Modal open={tOpen} onClose={() => setTOpen(false)} title="Add client testimonial">
        <div className="space-y-4">
          <Field label="Client name *" htmlFor="t-n"><input id="t-n" className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
          <Field label="Company" htmlFor="t-c"><input id="t-c" className="input" value={t.company} onChange={(e) => setT({ ...t, company: e.target.value })} /></Field>
          <Field label="Quote *" htmlFor="t-q"><textarea id="t-q" rows={4} className="input" value={t.quote} onChange={(e) => setT({ ...t, quote: e.target.value })} /></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={t.confirmed} onChange={(e) => setT({ ...t, confirmed: e.target.checked })} className="mt-1 accent-[#0b2a5b]" />I confirm this is a genuine testimonial and the client has given permission to publish it.</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.approved} onChange={(e) => setT({ ...t, approved: e.target.checked })} className="accent-[#0b2a5b]" />Show on website</label>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setTOpen(false)}>Cancel</button><button className="btn btn-navy" disabled={busy || !t.confirmed} onClick={saveT}>{busy && <Spinner className="h-4 w-4" />}Add testimonial</button></div>
        </div>
      </Modal>
    </div>
  );
}
