export const CONTACT = {
  phone: '+255 766 523 718',
  tel: '+255766523718',
  whatsapp: '255766523718',
  email: 'info@afrigate.co.tz',
  location: 'Dar es Salaam, Tanzania',
};

export const waLink = (text = 'Hello Afrigate, I would like to request a consultation.') =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;

export const STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned to Consultant',
  'Awaiting Customer Information',
  'In Progress',
  'Completed',
  'Closed',
] as const;

export const STATUS_META: Record<string, { tone: string; dot: string; help: string }> = {
  'Submitted': { tone: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', help: 'We have received your request.' },
  'Under Review': { tone: 'bg-sky-50 text-sky-800', dot: 'bg-sky-500', help: 'Our team is reviewing your request.' },
  'Assigned to Consultant': { tone: 'bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500', help: 'A consultant has been assigned.' },
  'Awaiting Customer Information': { tone: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500', help: 'Your consultant needs more information from you.' },
  'In Progress': { tone: 'bg-blue-50 text-blue-800', dot: 'bg-blue-600', help: 'Your consultant is working on your request.' },
  'Completed': { tone: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600', help: 'Guidance delivered. Review the outcome.' },
  'Closed': { tone: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400', help: 'This request is closed and archived.' },
};

export const URGENCY = ['Standard', 'Priority', 'Urgent'];
export const CONTACT_PREFS = ['Portal messages', 'Email', 'Phone call', 'WhatsApp', 'Video meeting', 'In-person meeting'];
export const MEETING_METHODS = ['In-person meeting', 'Phone call', 'Video meeting', 'WhatsApp call'];
export const DOC_CATEGORIES = ['Import / Export', 'Tax / VAT', 'Business Registration', 'Licence / Permit', 'Shipping / Logistics', 'Other'];
export const APPT_TONE: Record<string, string> = {
  Requested: 'bg-amber-50 text-amber-800',
  Confirmed: 'bg-emerald-50 text-emerald-800',
  Completed: 'bg-slate-100 text-slate-700',
  Cancelled: 'bg-red-50 text-red-700',
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const timeAgo = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
};
