import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { timeAgo } from '../lib/constants';

type N = { id: number; title: string; body: string; link: string | null; is_read: boolean; created_at: string };

export default function NotificationBell({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: N[]; unread: number }>('/api/account?action=notifications&limit=20');
      setItems(d.items); setUnread(d.unread); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openItem = async (n: N) => {
    setOpen(false);
    if (!n.is_read) { await api('/api/account?action=notifications', { method: 'PUT', body: { id: n.id } }).catch(() => {}); load(); }
    if (n.link) nav(n.link);
  };
  const readAll = async () => { await api('/api/account?action=notifications', { method: 'PUT', body: { all: true } }).catch(() => {}); load(); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications (${unread} unread)`} className={`relative grid h-10 w-10 place-items-center rounded-full transition ${dark ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-canvas'}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-deep">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="rise absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-display text-sm font-bold text-navy">Notifications</span>
            {unread > 0 && <button onClick={readAll} className="flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline"><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>}
          </div>
          <div className="scroll-thin max-h-96 overflow-y-auto">
            {error && <p className="p-4 text-sm text-danger">{error}</p>}
            {!error && items.length === 0 && <p className="p-6 text-center text-sm text-muted">You're all caught up.</p>}
            {items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={`flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left hover:bg-canvas ${n.is_read ? '' : 'bg-gold-soft/40'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-gold'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{n.title}</span>
                  <span className="block truncate text-xs text-muted">{n.body}</span>
                  <span className="block text-[11px] text-muted/80 mt-0.5">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
