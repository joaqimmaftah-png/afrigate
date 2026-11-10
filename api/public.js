import { supabase, cors, handleError, body, clean, isEmail, HttpError, audit, notify, adminIds } from './_lib/util.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const action = req.query.action;
  try {
    if (req.method === 'GET' && action === 'services') {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'GET' && action === 'service') {
      const { data, error } = await supabase.from('services').select('*').eq('slug', clean(req.query.slug, 100)).maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, 'Service not found.');
      return res.status(200).json(data);
    }
    if (req.method === 'GET' && action === 'articles') {
      let q = supabase.from('articles').select('id, slug, title, excerpt, category, tag, published_at').eq('published', true).order('published_at', { ascending: false });
      if (req.query.category) q = q.eq('category', clean(req.query.category, 20));
      if (req.query.limit) q = q.limit(Math.min(50, Number(req.query.limit) || 10));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'GET' && action === 'article') {
      const { data, error } = await supabase.from('articles').select('*').eq('slug', clean(req.query.slug, 200)).eq('published', true).maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, 'Article not found.');
      return res.status(200).json(data);
    }
    if (req.method === 'GET' && action === 'testimonials') {
      const { data, error } = await supabase.from('testimonials').select('id, name, company, quote').eq('approved', true).order('id', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST' && action === 'track') {
      const b = body(req);
      const ref = clean(b.reference, 40).toUpperCase();
      const email = clean(b.email, 200).toLowerCase();
      if (!ref || !isEmail(email)) throw new HttpError(400, 'Enter your reference number and the email used on your account.');
      const { data: c } = await supabase.from('consultations').select('*').eq('reference', ref).maybeSingle();
      if (!c) throw new HttpError(404, 'No request matches that reference and email.');
      const { data: cust } = await supabase.from('profiles').select('email').eq('id', c.customer_id).maybeSingle();
      if (!cust || (cust.email || '').toLowerCase() !== email) throw new HttpError(404, 'No request matches that reference and email.');
      const [{ data: svc }, { data: history }] = await Promise.all([
        supabase.from('services').select('title').eq('id', c.service_id).maybeSingle(),
        supabase.from('status_history').select('status, created_at').eq('consultation_id', c.id).order('created_at'),
      ]);
      return res.status(200).json({
        reference: c.reference,
        subject: c.subject,
        status: c.status,
        service: svc?.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
        has_consultant: !!c.consultant_id,
        history: history || [],
      });
    }
    if (req.method === 'POST' && action === 'enquiry') {
      const b = body(req);
      const name = clean(b.name, 120);
      const email = clean(b.email, 200);
      const message = clean(b.message, 4000);
      if (name.length < 2) throw new HttpError(400, 'Please enter your name.');
      if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
      if (message.length < 10) throw new HttpError(400, 'Please describe your enquiry (at least 10 characters).');
      const { data, error } = await supabase
        .from('enquiries')
        .insert({
          name,
          email,
          phone: clean(b.phone, 40) || null,
          company: clean(b.company, 160) || null,
          service_id: b.service_id ? Number(b.service_id) : null,
          message,
          status: 'New',
        })
        .select()
        .single();
      if (error) throw error;
      await audit(null, 'enquiry.received', 'enquiry', data.id, { email });
      await notify(await adminIds(), 'New website enquiry', `${name} sent an enquiry via the Contact page.`, '/staff/enquiries');
      return res.status(201).json({ ok: true, id: data.id });
    }
    throw new HttpError(404, 'Unknown action');
  } catch (err) {
    handleError(res, err);
  }
}
