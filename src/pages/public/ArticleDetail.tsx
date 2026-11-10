import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/constants';
import { PageLoader, Alert } from '../../components/ui';

function renderBody(body: string) {
  return body.split(/\n{2,}/).map((block, i) => {
    if (block.startsWith('### ')) return <h3 key={i}>{block.slice(4)}</h3>;
    const lines = block.split('\n');
    if (lines.every((l) => l.trim().startsWith('- '))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>;
    return <p key={i}>{block}</p>;
  });
}

export default function ArticleDetail({ category }: { category: 'news' | 'tax' }) {
  const { slug } = useParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [a, setA] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api(`/api/public?action=article&slug=${slug}`).then(setA).catch((e) => setErr(e.message)); }, [slug]);
  const back = category === 'tax' ? '/tax-information' : '/news';
  if (err) return <div className="mx-auto max-w-3xl p-8"><Alert>{err}</Alert></div>;
  if (!a) return <PageLoader />;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"><ArrowLeft className="h-4 w-4" />Back to {category === 'tax' ? 'Tax Information' : 'News & Updates'}</Link>
      <div className="mt-6 flex items-center gap-3 text-sm text-muted">
        {a.tag && <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold-deep">{a.tag}</span>}
        <span>{fmtDate(a.published_at)}</span>
      </div>
      <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-navy sm:text-4xl">{a.title}</h1>
      <p className="mt-4 text-lg text-muted">{a.excerpt}</p>
      <div className="prose-afg card mt-8 p-6 sm:p-8">{renderBody(a.body)}</div>
      {a.source_url && <a href={a.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"><ExternalLink className="h-4 w-4" />Source</a>}
      <div className="mt-10 rounded-2xl bg-navy p-6 text-white sm:flex sm:items-center sm:justify-between">
        <div><h2 className="font-display text-lg font-bold">Need advice on how this affects you?</h2><p className="text-sm text-white/75">Our consultants can review your specific situation.</p></div>
        <Link to="/portal/new" className="btn btn-gold mt-4 sm:mt-0">Request a Consultation</Link>
      </div>
    </article>
  );
}
