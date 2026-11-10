import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Newspaper, BookOpen, Calculator } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/constants';
import { Skeleton, Alert, EmptyState } from '../../components/ui';

type A = { id: number; slug: string; title: string; excerpt: string; category: string; tag: string | null; published_at: string };

export default function Articles({ category }: { category: 'news' | 'tax' }) {
  const [items, setItems] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tag, setTag] = useState('All');
  useEffect(() => {
    setLoading(true);
    api<A[]>(`/api/public?action=articles&category=${category}`).then(setItems).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [category]);
  const tags = ['All', ...Array.from(new Set(items.map((i) => i.tag).filter(Boolean) as string[]))];
  const shown = tag === 'All' ? items : items.filter((i) => i.tag === tag);
  const isTax = category === 'tax';
  return (
    <>
      <PageHero
        eyebrow={isTax ? 'Tax Information' : 'News & Updates'}
        title={isTax ? 'Tax Information & Guides' : 'News & Updates'}
        text={isTax ? 'Plain-language guides to common Tanzanian tax topics. Always confirm current rates and requirements with TRA or speak to an Afrigate consultant.' : 'Company announcements and regulatory developments relevant to trade, tax and business in Tanzania.'}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {err && <Alert>{err}</Alert>}
        {tags.length > 2 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {tags.map((t) => <button key={t} onClick={() => setTag(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tag === t ? 'bg-navy text-white' : 'bg-white text-muted hover:text-navy'}`}>{t}</button>)}
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-60" />)}
          {shown.map((a) => (
            <Link key={a.id} to={`/${isTax ? 'tax-information' : 'news'}/${a.slug}`} className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold-deep">{isTax ? <Calculator className="h-5 w-5" /> : <Newspaper className="h-5 w-5" />}</span>
                {a.tag && <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-navy">{a.tag}</span>}
              </div>
              <h2 className="mt-4 font-display text-lg font-bold leading-snug text-navy">{a.title}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{a.excerpt}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span>{fmtDate(a.published_at)}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-gold-deep">Read <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ))}
        </div>
        {!loading && !err && shown.length === 0 && <EmptyState icon={<BookOpen className="h-5 w-5" />} title="Nothing published yet" text="Please check back soon." />}
      </section>
    </>
  );
}
