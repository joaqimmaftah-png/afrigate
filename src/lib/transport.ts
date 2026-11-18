import { api } from './api';

export const TRANSPORT_ENABLED = import.meta.env.VITE_TRANSPORT_ENABLED === 'true';
export const CLIENT_TRANSPORT = '/portal/transport';
export const PROVIDER_INBOX = '/provider/inbox';
export const STAFF_PROVIDERS = '/staff/transport-providers';
export const MAX_SHORTLIST = 5;

export const SERVICES = { local: 'Local transport', transit: 'Transit transport' } as const;
export const CONTAINERS = {
  '20_dry': '20 ft standard', '40_dry': '40 ft standard', '40_high_cube': '40 ft high cube',
  '20_reefer': '20 ft reefer', '40_reefer': '40 ft reefer',
} as const;
export const CURRENCIES = ['TZS', 'USD', 'KES'] as const;
export type MoveType = keyof typeof SERVICES;
export type Container = keyof typeof CONTAINERS;
export type Currency = typeof CURRENCIES[number];
export type RequestStatus = 'open' | 'awaiting_confirmation' | 'booked' | 'closed';
export type ProviderStatus = 'pending' | 'approved' | 'suspended';
export type OpportunityStatus = 'needs_quote' | 'quoted' | 'confirm' | 'booked' | 'closed' | 'declined';

export type Lane = { service_type: MoveType; origin: string; destination: string };
export type Provider = {
  id: string; name: string; base_city: string; description: string; lanes: Lane[]; container_types: Container[];
};
export type AdminProvider = Provider & { status: ProviderStatus };
export type ProviderDetail = AdminProvider & {
  booking_email: string; verified_at: string | null;
  members: { id: string; name: string; email: string; active: boolean }[];
};
export type TransportRequest = Lane & {
  id: string; reference: string; status: RequestStatus; pickup_date: string; currency: Currency;
  container_type: Container; container_count: number; requirements: string; created_at: string;
};
export type RequestListItem = TransportRequest & { quote_count: number; invite_count: number };
export type Quote = {
  id: string; revision: number; base_amount: number; taxes: number; extra_charges: number; total: number;
  available_on: string; valid_until: string; terms: string; valid: boolean;
};
export type Offer = { provider_id: string; provider_name: string; provider_ready: boolean; quote: Quote | null; declined: boolean };
export type Booking = {
  reference: string; confirmed_at: string; provider_name: string; provider_email: string; customer_name: string; customer_email: string;
};
export type RequestDetail = {
  request: TransportRequest; offers: Offer[]; selected_quote_id: string | null; confirmation_due_at: string | null; booking: Booking | null;
};
export type Opportunity = {
  request: TransportRequest; provider_id: string; provider_name: string; quote: Quote | null;
  state: OpportunityStatus; confirmation_due_at: string | null; booking: Booking | null;
};
export type Page<T> = { items: T[]; has_more: boolean };
export type Change = { id: string; status: RequestStatus };

export function transportPath(action: string, query: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
  return `/api/transport?${params}`;
}
export const transportWrite = <T>(action: string, body: unknown) => api<T>(transportPath(action), { method: 'POST', body });
export const withShortlist = (path: string, ids: string[]) => ids.length ? `${path}?${new URLSearchParams({ ids: ids.join(',') })}` : path;

export const ROUTE_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const pickupDate = (date: string) => ROUTE_DATE.format(new Date(`${date}T00:00:00Z`));
export const todayEAT = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dar_es_Salaam' }).format(new Date());
export const deadline = (date: string) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam',
}).format(new Date(date)) + ' EAT';
export const price = (amount: number, currency: Currency) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(amount);
