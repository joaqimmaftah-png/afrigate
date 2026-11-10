import { supabase, cors, handleError, body, clean, getAuth, audit, HttpError } from './_lib/util.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const action = req.query.action || 'me';
  try {
    const { profile } = await getAuth(req);

    if (action === 'me' && req.method === 'GET') return res.status(200).json(profile);

    if (action === 'me' && req.method === 'PUT') {
      const b = body(req);
      const fullName = clean(b.full_name, 120);
      if (fullName.length < 2) throw new HttpError(400, 'Full name is required.');
      const patch = {
        full_name: fullName,
        phone: clean(b.phone, 40) || null,
        company_name: clean(b.company_name, 160) || null,
        company_tin: clean(b.company_tin, 40) || null,
        company_address: clean(b.company_address, 300) || null,
        business_type: clean(b.business_type, 120) || null,
        position: clean(b.position, 120) || null,
      };
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', profile.id).select().single();
      if (error) throw error;
      await audit(profile, 'profile.updated', 'profile', profile.id);
      return res.status(200).json(data);
    }

    if (action === 'notifications' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(Number(req.query.limit) || 40);
      if (error) throw error;
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      return res.status(200).json({ items: data, unread: count || 0 });
    }

    if (action === 'notifications' && req.method === 'PUT') {
      const b = body(req);
      let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id);
      if (!b.all) q = q.eq('id', Number(b.id));
      const { error } = await q;
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    throw new HttpError(404, 'Unknown action');
  } catch (err) {
    handleError(res, err);
  }
}
