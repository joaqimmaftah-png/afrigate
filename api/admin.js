import {
  supabase, cors, handleError, body, clean, getAuth, audit, HttpError, requireRole, isStaff,
  profileMap, serviceMap, STATUSES, ACTIVE_STATUSES, PENDING_STATUSES, DONE_STATUSES,
} from './_lib/util.js';

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const action = req.query.action;
  try {
    const { profile } = await getAuth(req);
    if (!isStaff(profile)) throw new HttpError(403, 'Staff access only.');
    const isAdmin = profile.role === 'admin';
    const adminOnly = () => requireRole(profile, ['admin']);

    // ---------- OVERVIEW ----------
    if (req.method === 'GET' && action === 'overview') {
      let cq = supabase.from('consultations').select('id, reference, subject, status, service_id, customer_id, consultant_id, created_at, updated_at, urgency');
      if (!isAdmin) cq = cq.eq('consultant_id', profile.id);
      const { data: cons } = await cq;
      const list = cons || [];
      const ids = list.map((c) => c.id);
      const { data: msgs } = ids.length
        ? await supabase.from('messages').select('consultation_id, sender_role, created_at').in('consultation_id', ids).neq('sender_role', 'system').order('created_at')
        : { data: [] };
      const lastBy = {};
      (msgs || []).forEach((m) => { lastBy[m.consultation_id] = m; });
      const unanswered = list.filter((c) => lastBy[c.id]?.sender_role === 'customer' && !DONE_STATUSES.includes(c.status));
      let aq = supabase.from('appointments').select('*').gte('scheduled_at', new Date().toISOString()).in('status', ['Requested', 'Confirmed']).order('scheduled_at').limit(8);
      if (!isAdmin) aq = aq.eq('consultant_id', profile.id);
      const { data: appts } = await aq;
      const services = await serviceMap();
      const people = await profileMap([...list.flatMap((c) => [c.customer_id, c.consultant_id]), ...(appts || []).map((a) => a.customer_id)]);
      let workload = [];
      if (isAdmin) {
        const { data: staff } = await supabase.from('profiles').select('id, full_name, role, is_active').in('role', ['consultant', 'admin']);
        workload = (staff || [])
          .filter((s) => s.is_active)
          .map((s) => ({
            id: s.id,
            full_name: s.full_name,
            role: s.role,
            active: list.filter((c) => c.consultant_id === s.id && ACTIVE_STATUSES.includes(c.status)).length,
            completed: list.filter((c) => c.consultant_id === s.id && DONE_STATUSES.includes(c.status)).length,
          }))
          .sort((a, b) => b.active - a.active);
      }
      const { data: activity } = isAdmin
        ? await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10)
        : { data: [] };
      const byService = Object.values(services).map((s) => ({ id: s.id, title: s.title, count: list.filter((c) => c.service_id === s.id).length }));
      const decorate = (c) => ({ ...c, service: services[c.service_id], customer: people[c.customer_id] ? { full_name: people[c.customer_id].full_name, company_name: people[c.customer_id].company_name } : null, consultant: people[c.consultant_id]?.full_name || null });
      return res.status(200).json({
        role: profile.role,
        totals: {
          all: list.length,
          pending: list.filter((c) => PENDING_STATUSES.includes(c.status)).length,
          new: list.filter((c) => c.status === 'Submitted').length,
          active: list.filter((c) => ACTIVE_STATUSES.includes(c.status)).length,
          awaiting_customer: list.filter((c) => c.status === 'Awaiting Customer Information').length,
          completed: list.filter((c) => DONE_STATUSES.includes(c.status)).length,
          unanswered: unanswered.length,
          customers: new Set(list.map((c) => c.customer_id)).size,
          unassigned: list.filter((c) => !c.consultant_id && !DONE_STATUSES.includes(c.status)).length,
        },
        byStatus: STATUSES.map((s) => ({ status: s, count: list.filter((c) => c.status === s).length })),
        byService,
        unanswered: unanswered.slice(0, 6).map(decorate),
        recent: [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8).map(decorate),
        upcoming: (appts || []).map((a) => ({ ...a, customer: people[a.customer_id]?.full_name || 'Customer', service: services[a.service_id]?.title })),
        workload,
        activity: activity || [],
      });
    }

    // ---------- STAFF LIST (for assignment) ----------
    if (req.method === 'GET' && action === 'consultants') {
      adminOnly();
      const { data: staff, error } = await supabase.from('profiles').select('id, full_name, email, role, is_active, position').in('role', ['consultant', 'admin']).eq('is_active', true).order('full_name');
      if (error) throw error;
      const { data: cons } = await supabase.from('consultations').select('consultant_id, status').in('status', ACTIVE_STATUSES);
      return res.status(200).json(staff.map((s) => ({ ...s, active: (cons || []).filter((c) => c.consultant_id === s.id).length })));
    }

    // ---------- USERS ----------
    if (action === 'users') {
      adminOnly();
      if (req.method === 'GET') {
        let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (req.query.role) q = q.eq('role', clean(req.query.role, 20));
        const { data, error } = await q.limit(1000);
        if (error) throw error;
        const { data: cons } = await supabase.from('consultations').select('customer_id, consultant_id, status');
        const s = clean(req.query.q, 100).toLowerCase();
        return res.status(200).json(
          data
            .filter((p) => !s || [p.full_name, p.email, p.company_name].filter(Boolean).some((v) => v.toLowerCase().includes(s)))
            .map((p) => ({
              ...p,
              requests: (cons || []).filter((c) => c.customer_id === p.id).length,
              assigned: (cons || []).filter((c) => c.consultant_id === p.id && ACTIVE_STATUSES.includes(c.status)).length,
            }))
        );
      }
      if (req.method === 'PUT') {
        const b = body(req);
        const id = clean(b.id, 60);
        if (id === profile.id) throw new HttpError(400, 'You cannot change your own role or status.');
        const patch = {};
        if (b.role !== undefined) {
          if (!['customer', 'consultant', 'admin'].includes(b.role)) throw new HttpError(400, 'Invalid role.');
          patch.role = b.role;
        }
        if (b.is_active !== undefined) patch.is_active = !!b.is_active;
        if (b.position !== undefined) patch.position = clean(b.position, 120) || null;
        const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single();
        if (error) throw error;
        await audit(profile, 'user.updated', 'profile', id, { email: data.email, ...patch });
        return res.status(200).json(data);
      }
    }

    // ---------- SERVICES ----------
    if (action === 'services') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('services').select('*').order('sort_order');
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'PUT') {
        adminOnly();
        const b = body(req);
        const short = clean(b.short_description, 200);
        if (short.length < 5) throw new HttpError(400, 'Short description is required.');
        const patch = {
          short_description: short,
          description: clean(b.description, 4000),
          highlights: Array.isArray(b.highlights) ? b.highlights.map((h) => clean(h, 200)).filter(Boolean).slice(0, 12) : [],
          is_active: b.is_active !== false,
        };
        const { data, error } = await supabase.from('services').update(patch).eq('id', Number(b.id)).select().single();
        if (error) throw error;
        await audit(profile, 'service.updated', 'service', data.id, { title: data.title });
        return res.status(200).json(data);
      }
    }

    // ---------- AUDIT ----------
    if (req.method === 'GET' && action === 'audit') {
      adminOnly();
      const page = Math.max(0, Number(req.query.page) || 0);
      let q = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * 50, page * 50 + 49);
      if (req.query.entity) q = q.eq('entity', clean(req.query.entity, 40));
      const { data, count, error } = await q;
      if (error) throw error;
      return res.status(200).json({ items: data, total: count || 0, page });
    }

    // ---------- REPORTS ----------
    if (req.method === 'GET' && action === 'reports') {
      adminOnly();
      const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 365 * 24 * 3600 * 1000);
      const to = req.query.to ? new Date(new Date(req.query.to).getTime() + 24 * 3600 * 1000 - 1) : new Date();
      const [{ data: cons }, { data: appts }, { data: enq }, services] = await Promise.all([
        supabase.from('consultations').select('*').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
        supabase.from('appointments').select('method, status, scheduled_at').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
        supabase.from('enquiries').select('id, status').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()),
        serviceMap(),
      ]);
      const list = cons || [];
      const people = await profileMap(list.map((c) => c.consultant_id));
      const done = list.filter((c) => c.completed_at);
      const avgDays = done.length ? done.reduce((s, c) => s + (new Date(c.completed_at) - new Date(c.created_at)), 0) / done.length / 86400000 : null;
      const months = {};
      list.forEach((c) => {
        const k = c.created_at.slice(0, 7);
        months[k] = months[k] || { month: k, submitted: 0, completed: 0 };
        months[k].submitted++;
        if (c.completed_at) months[k].completed++;
      });
      const consultants = {};
      list.filter((c) => c.consultant_id).forEach((c) => {
        const k = c.consultant_id;
        consultants[k] = consultants[k] || { name: people[k]?.full_name || 'Unknown', assigned: 0, completed: 0, active: 0 };
        consultants[k].assigned++;
        if (DONE_STATUSES.includes(c.status)) consultants[k].completed++;
        if (ACTIVE_STATUSES.includes(c.status)) consultants[k].active++;
      });
      const methods = {};
      (appts || []).forEach((a) => { methods[a.method] = (methods[a.method] || 0) + 1; });
      return res.status(200).json({
        range: { from: from.toISOString(), to: to.toISOString() },
        totals: {
          consultations: list.length,
          completed: list.filter((c) => DONE_STATUSES.includes(c.status)).length,
          open: list.filter((c) => !DONE_STATUSES.includes(c.status)).length,
          avg_days_to_complete: avgDays != null ? Math.round(avgDays * 10) / 10 : null,
          appointments: (appts || []).length,
          enquiries: (enq || []).length,
        },
        byStatus: STATUSES.map((s) => ({ label: s, value: list.filter((c) => c.status === s).length })),
        byService: Object.values(services).map((s) => ({ label: s.title, value: list.filter((c) => c.service_id === s.id).length })),
        byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
        consultants: Object.values(consultants),
        appointmentMethods: Object.entries(methods).map(([label, value]) => ({ label, value })),
      });
    }

    // ---------- ARTICLES ----------
    if (action === 'articles') {
      adminOnly();
      const b = body(req);
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('articles').select('*').order('published_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'POST' || req.method === 'PUT') {
        const title = clean(b.title, 200);
        const content = clean(b.body, 20000);
        if (title.length < 5) throw new HttpError(400, 'Title must be at least 5 characters.');
        if (content.length < 20) throw new HttpError(400, 'Article body is too short.');
        const row = {
          title,
          excerpt: clean(b.excerpt, 400) || content.slice(0, 200),
          body: content,
          category: b.category === 'tax' ? 'tax' : 'news',
          tag: clean(b.tag, 60) || null,
          published: !!b.published,
          source_url: clean(b.source_url, 400) || null,
        };
        if (req.method === 'POST') {
          row.slug = `${slugify(title)}-${Date.now().toString(36)}`;
          row.published_at = new Date().toISOString();
          const { data, error } = await supabase.from('articles').insert(row).select().single();
          if (error) throw error;
          await audit(profile, 'article.created', 'article', data.id, { title });
          return res.status(201).json(data);
        }
        const { data, error } = await supabase.from('articles').update(row).eq('id', Number(b.id)).select().single();
        if (error) throw error;
        await audit(profile, 'article.updated', 'article', data.id, { title });
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('articles').delete().eq('id', Number(b.id));
        if (error) throw error;
        await audit(profile, 'article.deleted', 'article', b.id);
        return res.status(200).json({ ok: true });
      }
    }

    // ---------- TESTIMONIALS ----------
    if (action === 'testimonials') {
      adminOnly();
      const b = body(req);
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('testimonials').select('*').order('id', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        const name = clean(b.name, 120);
        const quote = clean(b.quote, 1000);
        if (name.length < 2 || quote.length < 10) throw new HttpError(400, 'Client name and quote are required.');
        if (!b.confirmed) throw new HttpError(400, 'Please confirm the client has given permission to publish this testimonial.');
        const { data, error } = await supabase.from('testimonials').insert({ name, company: clean(b.company, 160) || null, quote, approved: !!b.approved }).select().single();
        if (error) throw error;
        await audit(profile, 'testimonial.created', 'testimonial', data.id, { name });
        return res.status(201).json(data);
      }
      if (req.method === 'PUT') {
        const { data, error } = await supabase.from('testimonials').update({ approved: !!b.approved }).eq('id', Number(b.id)).select().single();
        if (error) throw error;
        await audit(profile, 'testimonial.updated', 'testimonial', data.id, { approved: data.approved });
        return res.status(200).json(data);
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('testimonials').delete().eq('id', Number(b.id));
        if (error) throw error;
        await audit(profile, 'testimonial.deleted', 'testimonial', b.id);
        return res.status(200).json({ ok: true });
      }
    }

    // ---------- ENQUIRIES ----------
    if (action === 'enquiries') {
      adminOnly();
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(500);
        if (error) throw error;
        const services = await serviceMap();
        return res.status(200).json(data.map((e) => ({ ...e, service: services[e.service_id]?.title || null })));
      }
      if (req.method === 'PUT') {
        const b = body(req);
        if (!['New', 'Contacted', 'Resolved'].includes(b.status)) throw new HttpError(400, 'Invalid status.');
        const { data, error } = await supabase.from('enquiries').update({ status: b.status }).eq('id', Number(b.id)).select().single();
        if (error) throw error;
        await audit(profile, 'enquiry.updated', 'enquiry', data.id, { status: b.status });
        return res.status(200).json(data);
      }
    }

    throw new HttpError(404, 'Unknown action');
  } catch (err) {
    handleError(res, err);
  }
}
