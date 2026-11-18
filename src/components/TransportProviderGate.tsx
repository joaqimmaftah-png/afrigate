import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { homeFor, useAuth } from '../contexts/AuthContext';
import { transportPath } from '../lib/transport';
import { useTransportQuery } from '../pages/transport/useTransport';
import { Alert, EmptyState, PageLoader } from './ui';

export default function TransportProviderGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const access = useTransportQuery<{ provider: boolean }>(transportPath('access'));
  if (access.loading) return <PageLoader label="Checking workspace access…" />;
  if (access.data?.provider) return <>{children}</>;
  return <div className="mx-auto max-w-lg space-y-3 px-4 py-10">
    {access.error ? <Alert>{access.error} <button type="button" onClick={access.reload} className="font-semibold underline">Try again</button></Alert>
      : <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Provider workspace access required"
        text="An Afrigate administrator must add your account to an approved provider company before you can quote."
        action={<Link to={homeFor(profile)} className="btn btn-navy">Back to your portal</Link>} />}
  </div>;
}
