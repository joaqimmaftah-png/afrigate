import { supabase, cors, handleError, body, clean, getAuth, audit, notify, adminIds, HttpError, loadConsultation, isStaff, profileMap, serviceMap } from './_lib/util.js';

const METHODS = ['In-person meeting', 'Phone call', 'Video meeting', 'WhatsApp call'];
const STATUSES = ['Requested', 'Confirmed', 'Completed', 'Cancelled'];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const { profile } = await getAuth(req);

    if (req.method === 'GET') {
      let q = supabase.from('appointments').select('*').order('scheduled_at', { ascending: true });
      if (profile.role === 'customer') q = q.eq('customer_id', profile.id);
      else if (profile.role === 'consultant') q = q.eq('consultant_id', profile.id);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      const people = await profileMap(data.flatMap((a) => [a.customer_id, a.consultant_id]));
      const services = await serviceMap();
      const cids = [...new Set(data.map((a) => a.consultation_id).filter(Boolean))];
      const { data: cons } = cids.length ? await supabase.from('consultations').select('id, reference, subject').in('id', cids) : { data: [] };
      const cmap = Object.fromEntries((cons || []).map((c) => [c.id, c]));
      return res.status(200).json(
        data.map((a) => ({
          ...a,
          customer: people[a.customer_id] ? { full_name: people[a.customer_id].full_name, company_name: people[a.customer_id].company_name, phone: people[a.customer_id].phone, email: people[a.customer_id].email } : null,
          consultant: people[a.consultant_id] ? { full_name: people[a.consultant_id].full_name, email: people[a.consultant_id].email, phone: people[a.consultant_id].phone } : null,
          service: services[a.service_id] || null,
          consultation: cmap[a.consultation_id] || null,
        }))
      );
    }

    if (req.method === 'POST') {
      const b = body(req);
      const when = new Date(b.scheduled_at);
      if (isNaN(when.getTime())) throw new HttpError(400, 'Please choose a valid date and time.');
      if (when.getTime() < Date.now() + 30 * 60 * 1000) throw new HttpError(400, 'Please choose a time at least 30 minutes from now.');
      if (when.getTime() > Date.now() + 180 * 24 * 3600 * 1000) throw new HttpError(400, 'Appointments can be booked up to 6 months ahead.');
      const method = METHODS.includes(b.method) ? b.method : null;
      if (!method) throw new HttpError(400, 'Please choose how you would like to meet.');
      let customerId = profile.id;
      let consultantId = null;
      let serviceId = Number(b.service_id) || null;
      let consultation = null;
      if (b.consultation_id) {
        consultation = await loadConsultation(b.consultation_id, profile);
        customerId = consultation.customer_id;
        consultantId = consultation.consultant_id;
        serviceId = consultation.service_id;
      } else if (isStaff(profile)) {
        throw new HttpError(400, 'Staff must book appointments from within a consultation.');
      }
      if (!serviceId) throw new HttpError(400, 'Please choose a service.');
      const staff = isStaff(profile);
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({
          consultation_id: consultation?.id || null,
          customer_id: customerId,
          consultant_id: consultantId,
          service_id: serviceId,
          scheduled_at: when.toISOString(),
          duration_minutes: [30, 45, 60, 90].includes(Number(b.duration_minutes)) ? Number(b.duration_minutes) : 60,
          method,
          status: staff ? 'Confirmed' : 'Requested',
          notes: clean(b.notes, 1000) || null,
          meeting_link: staff ? clean(b.meeting_link, 400) || null : null,
          created_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;
      const whenText = when.toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });
      if (consultation) {
        await supabase.from('messages').insert({
          consultation_id: consultation.id, sender_id: null, sender_role: 'system', kind: 'system',
          body: `${staff ? 'Appointment scheduled' : 'Appointment requested'}: ${method} on ${whenText} (EAT).`,
          read_by_customer: !staff, read_by_staff: staff,
        });
      }
      if (staff) await notify([customerId], 'Appointment scheduled', `${method} on ${whenText} (EAT).`, '/portal/appointments');
      else await notify(consultantId ? [consultantId] : await adminIds(), 'Appointment requested', `${profile.full_name} requested a ${method.toLowerCase()} on ${whenText} (EAT).`, '/staff/appointments');
      await audit(profile, 'appointment.created', 'appointment', appt.id, { method, scheduled_at: appt.scheduled_at });
      return res.status(201).json(appt);
    }

    if (req.method === 'PUT') {
      const b = body(req);
      const { data: a } = await supabase.from('appointments').select('*').eq('id', Number(b.id)).maybeSingle();
      if (!a) throw new HttpError(404, 'Appointment not found.');
      const staff = isStaff(profile);
      if (profile.role === 'customer' && a.customer_id !== profile.id) throw new HttpError(403, 'Not allowed.');
      if (profile.role === 'consultant' && a.consultant_id !== profile.id) throw new HttpError(403, 'Not allowed.');
      const status = clean(b.status, 30);
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
      if (!staff && status !== 'Cancelled') throw new HttpError(403, 'Customers can only cancel appointments.');
      const patch = { status };
      if (staff && b.meeting_link !== undefined) patch.meeting_link = clean(b.meeting_link, 400) || null;
      if (staff && b.scheduled_at) {
        const d = new Date(b.scheduled_at);
        if (isNaN(d.getTime())) throw new HttpError(400, 'Invalid date.');
        patch.scheduled_at = d.toISOString();
      }
      if (staff && !a.consultant_id && profile.role === 'consultant') patch.consultant_id = profile.id;
      const { data: u, error } = await supabase.from('appointments').update(patch).eq('id', a.id).select().single();
      if (error) throw error;
      const whenText = new Date(u.scheduled_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });
      if (staff) await notify([a.customer_id], `Appointment ${status.toLowerCase()}`, `${u.method} on ${whenText} (EAT) is ${status.toLowerCase()}.`, '/portal/appointments');
      else await notify(a.consultant_id ? [a.consultant_id] : await adminIds(), 'Appointment cancelled by customer', `${profile.full_name} cancelled the ${u.method.toLowerCase()} on ${whenText}.`, '/staff/appointments');
      if (a.consultation_id) {
        await supabase.from('messages').insert({
          consultation_id: a.consultation_id, sender_id: null, sender_role: 'system', kind: 'system',
          body: `Appointment on ${whenText} (EAT) marked ${status}.`, read_by_customer: !staff, read_by_staff: staff,
        });
      }
      await audit(profile, 'appointment.updated', 'appointment', a.id, { status });
      return res.status(200).json(u);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    handleError(res, err);
  }
}
