import supabase from './supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const { data: { session } } = await supabase.auth.getSession();
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Network error — please check your connection and try again.');
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('The API returned an unexpected response. Please try again or contact Afrigate.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const BUCKET = 'consultation-docs';
export const MAX_FILE = 10 * 1024 * 1024;
export const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
];
export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv';

export function validateFile(f: File): string | null {
  if (!ALLOWED_TYPES.includes(f.type)) return `${f.name}: unsupported type. Use PDF, JPG/PNG/WebP, Word, Excel or CSV.`;
  if (f.size > MAX_FILE) return `${f.name}: larger than 10 MB.`;
  if (f.size === 0) return `${f.name}: file is empty.`;
  return null;
}

/** Upload a file securely: get a signed upload token, push directly to private storage, then register it. */
export async function uploadDocument(consultationId: number, file: File, category: string, isReport = false) {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const signed = await api<{ path: string; token: string }>('/api/files?action=sign', {
    method: 'POST',
    body: { consultation_id: consultationId, file_name: file.name, mime_type: file.type, size: file.size },
  });
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return api('/api/files?action=register', {
    method: 'POST',
    body: { consultation_id: consultationId, path: signed.path, file_name: file.name, mime_type: file.type, size: file.size, category, is_report: isReport },
  });
}

export async function downloadDocument(id: number) {
  const { url } = await api<{ url: string }>(`/api/files?action=download&id=${id}`);
  window.open(url, '_blank', 'noopener');
}
