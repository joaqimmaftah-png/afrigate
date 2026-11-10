import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../contexts/AuthContext';
import { PageLoader, Alert } from './ui';

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, profile, loading, profileError, signOut } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center"><PageLoader label="Opening your workspace…" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md space-y-4">
          <Alert>{profileError || 'We could not load your account.'}</Alert>
          <button className="btn btn-navy" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Navigate to={homeFor(profile)} replace />;
  return <>{children}</>;
}
