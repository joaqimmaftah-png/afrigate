import {
  supabase, cors, handleError, body, clean, getAuth, audit, notify, adminIds, HttpError,
  loadConsultation, setStatus, profileMap, serviceMap, isStaff, requireRole, STATUSES, DONE_STATUSES,
} from './_lib/util.js';

const URGENCY = ['Standard', 'Priority', 'Urgent'];
const CONTACT = ['Portal messages', 'Email', 'Phone call', 'WhatsApp', 'Video meeting', 'In-person meeting'];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const action = req.query.action;
  try {
    const { profile } = await getAuth(req);

    // ---------- LIST ----------
    if (req.method === 'GET' && action === 'list') {
      let q = supabase.from('consultations').select('*').order('updated_at', { ascending: false });
      if (profile.role === 'customer') q = q.eq('customer_id', profile.id);
      else if (profile.role === 'consultant') q = q.eq('consultant_id', profile.id);
      if (req.query.status) q = q.eq('status', clean(req.query.status, 60));
      if (req.query.service_id) q = q.eq('service_id', Number(req.query.service_id));
      if (req.query.consultant_id && profile.role === 'admin') {
        if (req.query.consultant_id === 'none') q = q.is('consultant_id', null);
        else q = q.eq('consultant_id', clean(req.query.consultant_id, 60));
      }
      const { data: rows, error } = await q.limit(500);
      if (error) throw error;
      const ids = rows.map((r) => r.id);
      const [people, services, msgRes] = await Promise.all([
        profileMap(rows.flatMap((r) => [r.customer_id, r.consultant_id])),
        serviceMap(),
        ids.length
          ? supabase.from('messages').select('consultation_id, sender_role, created_at, read_by_customer, read_by_staff').in('consultation_id', ids).order('created_at')
          : Promise.resolve({ data: [] }),
      ]);
      const msgs = msgRes.data || [];
      const search = clean(req.query.q, 100).toLowerCase();
      const out = rows
        .map((r) => {
          const mine = msgs.filter((m) => m.consultation_id === r.id && m.sender_role !== 'system');
          const last = mine[mine.length - 1];
          const unread = profile.role === 'customer'
            ? mine.filter((m) => m.sender_role !== 'customer' && !m.read_by_customer).length
            : mine.filter((m) => m.sender_role === 'customer' && !m.read_by_staff).length;
          return {
            ...r,
            service: services[r.service_id] || null,
            customer: people[r.customer_id] || null,
            consultant: people[r.consultant_id] || null,
            unread,
            awaiting_reply: !!last && last.sender_role === 'customer' && !DONE_STATUSES.includes(r.status),
            last_message_at: last?.created_at || null,
          };
        })
        .filter((r) => {
          if (!search) return true;
          return [r.reference, r.subject, r.customer?.full_name, r.customer?.company_name, r.service?.title]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search));
        });
      return res.status(200).json(out);
    }

    // ---------- DETAIL ----------
    if (req.method === 'GET' && action === 'detail') {
      const c = await loadConsultation(req.query.id, profile);
      const [{ data: history }, { data: messages }, { data: documents }, { data: appointments }, { data: service }] = await Promise.all([
        supabase.from('status_history').select('*').eq('consultation_id', c.id).order('created_at'),
        supabase.from('messages').select('*').eq('consultation_id', c.id).order('created_at'),
        supabase.from('documents').select('*').eq('consultation_id', c.id).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').eq('consultation_id', c.id).order('scheduled_at'),
        supabase.from('services').select('*').eq('id', c.service_id).maybeSingle(),
      ]);
      const people = await profileMap([
        c.customer_id,
        c.consultant_id,
        ...(messages || []).map((m) => m.sender_id),
        ...(documents || []).map((d) => d.uploaded_by),
      ]);
      // mark as read for viewer side
      if (profile.role === 'customer') {
        await supabase.from('messages').update({ read_by_customer: true }).eq('consultation_id', c.id).neq('sender_role', 'customer').eq('read_by_customer', false);
      } else if (profile.role === 'admin' || c.consultant_id === profile.id) {
        await supabase.from('messages').update({ read_by_staff: true }).eq('consultation_id', c.id).eq('sender_role', 'customer').eq('read_by_staff', false);
      }
      const strip = (p) => (p ? { id: p.id, full_name: p.full_name, role: p.role, email: p.email, phone: p.phone, company_name: p.company_name } : null);
      return res.status(200).json({
        consultation: c,
        service,
        customer: strip(people[c.customer_id]),
        consultant: strip(people[c.consultant_id]),
        history: history || [],
        messages: (messages || []).map((m) => ({ ...m, sender: people[m.sender_id] ? { full_name: people[m.sender_id].full_name, role: people[m.sender_id].role } : null })),
        documents: (documents || []).map((d) => ({ ...d, uploader: people[d.uploaded_by]?.full_name || 'Unknown' })),
        appointments: appointments || [],
      });
    }

    // ---------- CREATE ----------
    if (req.method === 'POST' && action === 'create') {
      requireRole(profile, ['customer']);
      const b = body(req);
      const serviceId = Number(b.service_id);
      const subject = clean(b.subject, 160);
      const description = clean(b.description, 6000);
      if (!serviceId) throw new HttpError(400, 'Please choose a service.');
      if (subject.length < 5) throw new HttpError(400, 'Please provide a short subject (at least 5 characters).');
      if (description.length < 20) throw new HttpError(400, 'Please describe your issue in a little more detail (at least 20 characters).');
      const { data: svc } = await supabase.from('services').select('id, title, is_active').eq('id', serviceId).maybeSingle();
      if (!svc || !svc.is_active) throw new HttpError(400, 'Selected service is not available.');
      const now = new Date().toISOString();
      const { data: created, error } = await supabase
        .from('consultations')
        .insert({
          customer_id: profile.id,
          service_id: serviceId,
          subject,
          description,
          urgency: URGENCY.includes(b.urgency) ? b.urgency : 'Standard',
          preferred_contact: CONTACT.includes(b.preferred_contact) ? b.preferred_contact : 'Portal messages',
          status: 'Submitted',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      const reference = `AFG-${new Date().getFullYear()}-${String(created.id).padStart(6, '0')}`;
      const { data: c, error: refErr } = await supabase.from('consultations').update({ reference }).eq('id', created.id).select().single();
      if (refErr) throw refErr;
      await supabase.from('status_history').insert({ consultation_id: c.id, status: 'Submitted', note: 'Request submitted by customer.', changed_by: profile.id, changed_by_name: profile.full_name });
      await supabase.from('messages').insert({
        consultation_id: c.id, sender_id: null, sender_role: 'system', kind: 'system',
        body: `Request ${reference} received for ${svc.title}. Our team will review it and assign a consultant shortly.`,
        read_by_customer: true, read_by_staff: true,
      });
      await audit(profile, 'consultation.created', 'consultation', c.id, { reference, service: svc.title });
      await notify([profile.id], 'Request received', `Your request ${reference} has been submitted.`, `/portal/requests/${c.id}`);
      await notify(await adminIds(), 'New consultation request', `${profile.full_name} submitted ${reference} (${svc.title}).`, `/staff/consultations/${c.id}`);
      return res.status(201).json(c);
    }

    // ---------- MESSAGE ----------
    if (req.method === 'POST' && action === 'message') {
      const b = body(req);
      const c = await loadConsultation(b.id, profile);
      const text = clean(b.body, 5000);
      if (!text) throw new HttpError(400, 'Message cannot be empty.');
      if (c.status === 'Closed') throw new HttpError(400, 'This consultation is closed. Please start a new request.');
      const staff = isStaff(profile);
      const kind = staff && b.kind === 'info_request' ? 'info_request' : 'message';
      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          consultation_id: c.id,
          sender_id: profile.id,
          sender_role: staff ? profile.role : 'customer',
          body: text,
          kind,
          read_by_customer: !staff,
          read_by_staff: staff,
        })
        .select()
        .single();
      if (error) throw error;
      let updated = c;
      if (kind === 'info_request') {
        updated = await setStatus(c, 'Awaiting Customer Information', profile, 'Consultant requested additional information.');
      } else if (!staff && c.status === 'Awaiting Customer Information') {
        updated = await setStatus(c, c.consultant_id ? 'In Progress' : 'Under Review', profile, 'Customer responded with information.');
      } else {
        await supabase.from('consultations').update({ updated_at: new Date().toISOString() }).eq('id', c.id);
      }
      if (staff) {
        await notify([c.customer_id], kind === 'info_request' ? 'Information requested' : 'New message from your consultant', `${c.reference}: ${text.slice(0, 120)}`, `/portal/requests/${c.id}`);
      } else {
        const targets = c.consultant_id ? [c.consultant_id] : await adminIds();
        await notify(targets, 'New customer message', `${c.reference}: ${text.slice(0, 120)}`, `/staff/consultations/${c.id}`);
      }
      await audit(profile, kind === 'info_request' ? 'consultation.info_requested' : 'message.sent', 'consultation', c.id, { reference: c.reference });
      return res.status(201).json({ message: msg, consultation: updated });
    }

    // ---------- STATUS (staff) ----------
    if (req.method === 'PUT' && action === 'status') {
      const b = body(req);
      if (!isStaff(profile)) {
        // customers may close their own completed request
        const c = await loadConsultation(b.id, profile);
        if (!(b.status === 'Closed' && c.status === 'Completed')) throw new HttpError(403, 'You do not have permission to change this status.');
        const u = await setStatus(c, 'Closed', profile, 'Closed by customer.');
        await audit(profile, 'consultation.closed', 'consultation', c.id, { reference: c.reference });
        return res.status(200).json(u);
      }
      const c = await loadConsultation(b.id, profile);
      if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status.');
      if (b.status === 'Assigned to Consultant' && !c.consultant_id) throw new HttpError(400, 'Assign a consultant first.');
      const u = await setStatus(c, b.status, profile, clean(b.note, 500) || null);
      await supabase.from('messages').insert({
        consultation_id: c.id, sender_id: null, sender_role: 'system', kind: 'system',
        body: `Status updated to "${b.status}"${b.note ? ` — ${clean(b.note, 500)}` : ''}.`,
        read_by_customer: false, read_by_staff: true,
      });
      await notify([c.customer_id], 'Request status updated', `${c.reference} is now: ${b.status}.`, `/portal/requests/${c.id}`);
      await audit(profile, 'consultation.status_changed', 'consultation', c.id, { reference: c.reference, from: c.status, to: b.status });
      return res.status(200).json(u);
    }

    // ---------- ASSIGN (admin) ----------
    if (req.method === 'PUT' && action === 'assign') {
      requireRole(profile, ['admin']);
      const b = body(req);
      const c = await loadConsultation(b.id, profile);
      const { data: consultant } = await supabase.from('profiles').select('*').eq('id', clean(b.consultant_id, 60)).maybeSingle();
      if (!consultant || !['consultant', 'admin'].includes(consultant.role) || !consultant.is_active) throw new HttpError(400, 'Select an active consultant.');
      await supabase.from('consultations').update({ consultant_id: consultant.id }).eq('id', c.id);
      const u = await setStatus({ ...c, consultant_id: consultant.id }, 'Assigned to Consultant', profile, `Assigned to ${consultant.full_name}.`);
      await supabase.from('messages').insert({
        consultation_id: c.id, sender_id: null, sender_role: 'system', kind: 'system',
        body: `${consultant.full_name} has been assigned as your consultant.`,
        read_by_customer: false, read_by_staff: true,
      });
      await supabase.from('appointments').update({ consultant_id: consultant.id }).eq('consultation_id', c.id).in('status', ['Requested', 'Confirmed']);
      await notify([consultant.id], 'New assignment', `You have been assigned ${c.reference}.`, `/staff/consultations/${c.id}`);
      await notify([c.customer_id], 'Consultant assigned', `${consultant.full_name} will handle ${c.reference}.`, `/portal/requests/${c.id}`);
      await audit(profile, 'consultation.assigned', 'consultation', c.id, { reference: c.reference, consultant: consultant.email });
      return res.status(200).json(u);
    }

    // ---------- ACCEPT (assigned consultant) ----------
    if (req.method === 'PUT' && action === 'accept') {
      requireRole(profile, ['consultant', 'admin']);
      const b = body(req);
      const c = await loadConsultation(b.id, profile);
      if (c.consultant_id !== profile.id) throw new HttpError(403, 'Only the assigned consultant can accept this request.');
      const u = await setStatus(c, 'In Progress', profile, 'Consultant accepted the request and started work.');
      await supabase.from('messages').insert({
        consultation_id: c.id, sender_id: null, sender_role: 'system', kind: 'system',
        body: `${profile.full_name} accepted your request and is now working on it.`,
        read_by_customer: false, read_by_staff: true,
      });
      await notify([c.customer_id], 'Consultation in progress', `${profile.full_name} has started work on ${c.reference}.`, `/portal/requests/${c.id}`);
      await audit(profile, 'consultation.accepted', 'consultation', c.id, { reference: c.reference });
      return res.status(200).json(u);
    }

    // ---------- OUTCOME (staff) ----------
    if (req.method === 'PUT' && action === 'outcome') {
      requireRole(profile, ['consultant', 'admin']);
      const b = body(req);
      const c = await loadConsultation(b.id, profile);
      const outcome = clean(b.outcome, 8000);
      if (outcome.length < 10) throw new HttpError(400, 'Please write the consultation outcome / guidance (at least 10 characters).');
      const { data: u, error } = await supabase.from('consultations').update({ outcome, updated_at: new Date().toISOString() }).eq('id', c.id).select().single();
      if (error) throw error;
      let final = u;
      if (b.complete) final = await setStatus(u, 'Completed', profile, 'Consultation outcome delivered.');
      await notify([c.customer_id], b.complete ? 'Consultation completed' : 'Consultant feedback updated', `${c.reference}: guidance from your consultant is available.`, `/portal/requests/${c.id}`);
      await audit(profile, b.complete ? 'consultation.completed' : 'consultation.outcome_saved', 'consultation', c.id, { reference: c.reference });
      return res.status(200).json(final);
    }

    throw new HttpError(404, 'Unknown action');
  } catch (err) {
    handleError(res, err);
  }
}
