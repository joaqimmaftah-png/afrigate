import supabase from './db-client.js';

export const STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned to Consultant',
  'Awaiting Customer Information',
  'In Progress',
  'Completed',
  'Closed',
];
export const OPEN_STATUSES = STATUSES.slice(0, 5);
export const ACTIVE_STATUSES = ['Assigned to Consultant', 'Awaiting Customer Information', 'In Progress'];
export const PENDING_STATUSES = ['Submitted', 'Under Review'];
export const DONE_STATUSES = ['Completed', 'Closed'];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function handleError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('API request failed', { status, code: err.code || 'internal_error' });
  res.status(status).json({ error: status >= 500 ? 'The service is temporarily unavailable. Please try again later.' : err.message });
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function clean(v, max = 5000) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

/** Resolve the authenticated user + profile (auto-provisions a customer profile). */
export async function getAuth(req, { optional = false } = {}) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    if (optional) return null;
    throw new HttpError(401, 'Please sign in to continue.');
  }
  const { data: { user } = {}, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    if (optional) return null;
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  let { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    const meta = user.user_metadata || {};
    const { data: created, error: insErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: meta.full_name || meta.name || (user.email || '').split('@')[0],
        phone: meta.phone || null,
        company_name: meta.company_name || null,
        role: 'customer',
        is_active: true,
      })
      .select()
      .single();
    if (insErr) throw insErr;
    profile = created;
    await audit(profile, 'account.created', 'profile', profile.id, { email: profile.email });
  }
  if (profile.is_active === false) throw new HttpError(403, 'This account has been deactivated. Please contact Afrigate.');
  return { user, profile };
}

export function requireRole(profile, roles) {
  if (!roles.includes(profile.role)) throw new HttpError(403, 'You do not have permission to perform this action.');
}

export const isStaff = (p) => p && (p.role === 'consultant' || p.role === 'admin');

export async function audit(actor, action, entity, entityId, details = {}) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: actor?.id || null,
      actor_email: actor?.email || 'system',
      actor_role: actor?.role || 'system',
      action,
      entity,
      entity_id: entityId != null ? String(entityId) : null,
      details,
    });
  } catch (e) {
    console.error('audit failed', e);
  }
}

export async function notify(userIds, title, message, link) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return;
  try {
    await supabase.from('notifications').insert(ids.map((user_id) => ({ user_id, title, body: message, link, is_read: false })));
  } catch (e) {
    console.error('notify failed', e);
  }
}

export async function adminIds() {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true);
  return (data || []).map((r) => r.id);
}

export async function profileMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, company_name, role')
    .in('id', unique);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

export async function serviceMap() {
  const { data } = await supabase.from('services').select('id, slug, title, icon');
  return Object.fromEntries((data || []).map((s) => [s.id, s]));
}

/** Load a consultation and verify the caller may access it. */
export async function loadConsultation(id, profile) {
  const { data: c, error } = await supabase.from('consultations').select('*').eq('id', Number(id)).maybeSingle();
  if (error) throw error;
  if (!c) throw new HttpError(404, 'Consultation not found.');
  if (profile.role === 'admin') return c;
  if (profile.role === 'consultant' && c.consultant_id === profile.id) return c;
  if (profile.role === 'customer' && c.customer_id === profile.id) return c;
  throw new HttpError(403, 'You do not have access to this consultation.');
}

export async function setStatus(c, status, actor, note) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  const patch = { status, updated_at: new Date().toISOString() };
  if (status === 'Completed') patch.completed_at = new Date().toISOString();
  const { data, error } = await supabase.from('consultations').update(patch).eq('id', c.id).select().single();
  if (error) throw error;
  await supabase.from('status_history').insert({
    consultation_id: c.id,
    status,
    note: note || null,
    changed_by: actor?.id || null,
    changed_by_name: actor?.full_name || 'System',
  });
  return data;
}

export { supabase };
