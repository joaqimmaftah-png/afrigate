import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export type Service = {
  id: number;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  highlights: string[];
  icon: string;
  sort_order: number;
  is_active: boolean;
};

const Ctx = createContext<{ services: Service[]; loading: boolean; error: string | null; reload: () => void }>({
  services: [], loading: true, error: null, reload: () => {},
});

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    api<Service[]>('/api/public?action=services')
      .then((d) => {
        if (!Array.isArray(d)) throw new Error('The services response is invalid. Please try again.');
        setServices(d); setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return <Ctx.Provider value={{ services, loading, error, reload: load }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useServices = () => useContext(Ctx);
