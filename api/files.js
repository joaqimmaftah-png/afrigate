import { supabase, cors, handleError, body, clean, getAuth, audit, notify, adminIds, HttpError, loadConsultation, isStaff, profileMap } from './_lib/util.js';

const BUCKET = 'consultation-docs';
const MAX = 10 * 1024 * 1024;
const ALLOWED = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};
export const CATEGORIES = ['Import / Export', 'Tax / VAT', 'Business Registration', 'Licence / Permit', 'Shipping / Logistics', 'Consultation Report', 'Other'];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const action = req.query.action;
  try {
    const { profile } = await getAuth(req);

    if (req.method === 'POST' && action === 'sign') {
      const b = body(req);
      const c = await loadConsultation(b.consultation_id, profile);
      if (c.status === 'Closed') throw new HttpError(400, 'This consultation is closed.');
      const size = Number(b.size);
      if (!ALLOWED[b.mime_type]) throw new HttpError(400, 'Unsupported file type. Upload PDF, image (JPG/PNG/WebP), Word, Excel or CSV files.');
      if (!size || size > MAX) throw new HttpError(400, 'Files must be smaller than 10 MB.');
      const safe = clean(b.file_name, 140).replace(/[^a-zA-Z0-9._-]+/g, '_') || `file.${ALLOWED[b.mime_type]}`;
      const path = `${c.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return res.status(200).json({ path: data.path || path, token: data.token });
    }

    if (req.method === 'POST' && action === 'register') {
      const b = body(req);
      const c = await loadConsultation(b.consultation_id, profile);
      const path = clean(b.path, 400);
      if (!path.startsWith(`${c.id}/`)) throw new HttpError(400, 'Invalid file path.');
      const folder = path.split('/').slice(0, -1).join('/');
      const fname = path.split('/').pop();
      const { data: listed } = await supabase.storage.from(BUCKET).list(folder, { search: fname });
      if (!listed || !listed.some((o) => o.name === fname)) throw new HttpError(400, 'Upload not found. Please try again.');
      const staff = isStaff(profile);
      const category = CATEGORIES.includes(b.category) ? b.category : 'Other';
      const isReport = staff && (b.is_report === true || category === 'Consultation Report');
      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          consultation_id: c.id,
          uploaded_by: profile.id,
          uploader_role: staff ? profile.role : 'customer',
          file_name: clean(b.file_name, 200),
          storage_path: path,
          mime_type: clean(b.mime_type, 120),
          size_bytes: Number(b.size) || 0,
          category: isReport ? 'Consultation Report' : category,
          is_report: isReport,
          note: clean(b.note, 300) || null,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('messages').insert({
        consultation_id: c.id, sender_id: null, sender_role: 'system', kind: 'document',
        body: `${profile.full_name} uploaded ${isReport ? 'a consultation report' : 'a document'}: ${doc.file_name}`,
        read_by_customer: !staff, read_by_staff: staff,
      });
      await supabase.from('consultations').update({ updated_at: new Date().toISOString() }).eq('id', c.id);
      if (staff) await notify([c.customer_id], isReport ? 'Consultation report available' : 'New document shared', `${c.reference}: ${doc.file_name}`, `/portal/requests/${c.id}`);
      else await notify(c.consultant_id ? [c.consultant_id] : await adminIds(), 'Customer uploaded a document', `${c.reference}: ${doc.file_name}`, `/staff/consultations/${c.id}`);
      await audit(profile, 'document.uploaded', 'document', doc.id, { reference: c.reference, file: doc.file_name, category: doc.category });
      return res.status(201).json(doc);
    }

    if (req.method === 'GET' && action === 'download') {
      const { data: doc } = await supabase.from('documents').select('*').eq('id', Number(req.query.id)).maybeSingle();
      if (!doc) throw new HttpError(404, 'Document not found.');
      await loadConsultation(doc.consultation_id, profile);
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 120, { download: doc.file_name });
      if (error) throw error;
      await audit(profile, 'document.downloaded', 'document', doc.id, { file: doc.file_name });
      return res.status(200).json({ url: data.signedUrl });
    }

    if (req.method === 'GET' && action === 'list') {
      let cq = supabase.from('consultations').select('id, reference, subject');
      if (profile.role === 'customer') cq = cq.eq('customer_id', profile.id);
      else if (profile.role === 'consultant') cq = cq.eq('consultant_id', profile.id);
      const { data: cons } = await cq;
      const ids = (cons || []).map((c) => c.id);
      if (!ids.length) return res.status(200).json([]);
      const { data: docs, error } = await supabase.from('documents').select('*').in('consultation_id', ids).order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const people = await profileMap(docs.map((d) => d.uploaded_by));
      const cmap = Object.fromEntries(cons.map((c) => [c.id, c]));
      return res.status(200).json(docs.map((d) => ({ ...d, uploader: people[d.uploaded_by]?.full_name || 'Unknown', consultation: cmap[d.consultation_id] })));
    }

    throw new HttpError(404, 'Unknown action');
  } catch (err) {
    handleError(res, err);
  }
}
