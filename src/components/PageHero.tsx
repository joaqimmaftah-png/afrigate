import type { ReactNode } from 'react';

export default function PageHero({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-navy">
      <img src="/images/hero-port.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy/95 to-navy/70" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        {eyebrow && <div className="rise text-xs font-bold uppercase tracking-[0.2em] text-gold">{eyebrow}</div>}
        <h1 className="rise mt-2 max-w-3xl font-display text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
        {text && <p className="rise mt-3 max-w-2xl text-white/80" style={{ animationDelay: '.1s' }}>{text}</p>}
        {children}
      </div>
    </section>
  );
}
