import { body, cors, getAuth, handleError, HttpError, supabase } from './_lib/util.js';

const READ = new Set(['access', 'directory', 'requests', 'request', 'inbox', 'opportunity', 'providers', 'provider']);
const WRITE = new Set(['save_provider', 'set_provider_status', 'add_member', 'remove_member', 'create_request',
  'submit_quote', 'select_quote', 'release_quote', 'decline', 'confirm', 'close_request']);
const USER_ERRORS = { PT400: 400, PT403: 403, PT404: 404, PT409: 409 };
const INPUT_ERRORS = new Set(['22P02', '22007', '22008', '22003', '22023', '23502', '23514']);
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function readInput(query) {
  const input = {};
  for (const [key, max] of Object.entries({ id: 36, provider_id: 36, q: 120, origin: 100, destination: 100, service: 10, container: 20, page: 5 })) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > max) throw new HttpError(400, 'Check the search filters and try again.');
    input[key] = value.trim();
  }
  if (query.ids !== undefined) {
    const ids = typeof query.ids === 'string' && query.ids.length <= 184 ? query.ids.split(',') : [];
    if (ids.length < 1 || ids.length > 5 || ids.some(id => !UUID.test(id))) {
      throw new HttpError(400, 'Choose up to five valid providers.');
    }
    input.ids = [...new Set(ids.map(id => id.toLowerCase()))];
  }
  return input;
}

export function createTransportHandler({ authenticate = getAuth, client = supabase, enabled = () => process.env.TRANSPORT_ENABLED === 'true' } = {}) {
  return async function transport(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (cors(req, res)) return;
    try {
      if (!enabled()) throw new HttpError(404, 'The transport workspace is not enabled.');
      const { profile } = await authenticate(req);
      const action = req.query?.action;
      const reading = req.method === 'GET' && READ.has(action);
      const writing = req.method === 'POST' && WRITE.has(action);
      if (!reading && !writing) throw new HttpError(404, 'Unknown transport action.');
      const input = reading ? readInput(req.query) : body(req);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Buffer.byteLength(JSON.stringify(input)) > 12000) {
        throw new HttpError(400, 'Invalid transport details.');
      }
      // The client cannot set or override the actor across this trust boundary.
      const { data, error } = await client.rpc(reading ? 'transport_read' : 'transport_write', {
        p_actor: profile.id, p_action: action, p_input: input,
      });
      if (error && Object.hasOwn(USER_ERRORS, error.code)) throw new HttpError(USER_ERRORS[error.code], error.message);
      if (error && INPUT_ERRORS.has(error.code)) throw new HttpError(400, 'Check the required fields, dates, and amounts and try again.');
      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      handleError(res, err);
    }
  };
}

export default createTransportHandler();
