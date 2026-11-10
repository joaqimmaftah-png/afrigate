import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FilePlus2, FolderKanban, CalendarDays, FileText, UserCircle2, LogOut, Menu, X, Globe,
  Users, Settings2, ScrollText, BarChart3, Newspaper, Inbox, ListChecks,
} from 'lucide-react';
import { Logo } from './ui';
import NotificationBell from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';

type Item = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

const CUSTOMER: Item[] = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/new', label: 'New Consultation', icon: FilePlus2 },
  { to: '/portal/requests', label: 'My Requests', icon: FolderKanban },
  { to: '/portal/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/portal/documents', label: 'Documents', icon: FileText },
  { to: '/portal/profile', label: 'Profile & Company', icon: UserCircle2 },
];

const CONSULTANT: Item[] = [
  { to: '/staff', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/staff/consultations', label: 'Consultations', icon: ListChecks },
  { to: '/staff/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/staff/documents', label: 'Documents', icon: FileText },
  { to: '/staff/profile', label: 'My Profile', icon: UserCircle2 },
];

const ADMIN_EXTRA: Item[] = [
  { to: '/staff/users', label: 'Users & Roles', icon: Users },
  { to: '/staff/services', label: 'Service Categories', icon: Settings2 },
  { to: '/staff/content', label: 'News & Content', icon: Newspaper },
  { to: '/staff/enquiries', label: 'Website Enquiries', icon: Inbox },
  { to: '/staff/reports', label: 'Reports', icon: BarChart3 },
  { to: '/staff/audit', label: 'Activity Log', icon: ScrollText },
];

export default function PortalLayout({ area }: { area: 'customer' | 'staff' }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  const items = area === 'customer' ? CUSTOMER : CONSULTANT;
  const admin = area === 'staff' && profile?.role === 'admin' ? ADMIN_EXTRA : [];
  const initials = (profile?.full_name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const doSignOut = async () => { await signOut(); nav('/'); };

  const Side = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Link to="/"><Logo variant="light" compact /></Link>
        <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
          {area === 'customer' ? 'Client Portal' : profile?.role === 'admin' ? 'Administrator' : 'Consultant Workspace'}
        </div>
      </div>
      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-gold text-navy-deep' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
            <i.icon className="h-[18px] w-[18px]" />{i.label}
          </NavLink>
        ))}
        {admin.length > 0 && <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Administration</div>}
        {admin.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-gold text-navy-deep' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
            <i.icon className="h-[18px] w-[18px]" />{i.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"><Globe className="h-[18px] w-[18px]" />Public website</Link>
        <button onClick={doSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"><LogOut className="h-[18px] w-[18px]" />Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">{Side}</aside>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-navy-deep/60" onClick={() => setOpen(false)} />
          <aside className="rise absolute inset-y-0 left-0 w-72 bg-navy">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 text-white" aria-label="Close menu"><X className="h-6 w-6" /></button>
            {Side}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-navy hover:bg-canvas lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <div className="hidden text-sm text-muted sm:block">Welcome back, <span className="font-semibold text-ink">{profile?.full_name?.split(' ')[0]}</span></div>
          </div>
          <div className="flex items-center gap-2">
            {area === 'customer' && <Link to="/portal/new" className="btn btn-gold btn-sm hidden sm:inline-flex"><FilePlus2 className="h-4 w-4" />Request Consultation</Link>}
            <NotificationBell />
            <Link to={area === 'customer' ? '/portal/profile' : '/staff/profile'} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-canvas">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-xs font-bold text-white">{initials}</span>
              <span className="hidden text-left md:block">
                <span className="block text-sm font-semibold leading-tight text-ink">{profile?.full_name}</span>
                <span className="block text-[11px] capitalize leading-tight text-muted">{profile?.role}{profile?.company_name && area === 'customer' ? ` · ${profile.company_name}` : ''}</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
