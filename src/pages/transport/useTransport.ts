import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { transportWrite } from '../../lib/transport';

export function useTransportQuery<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ path: string; version: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path).then(
      data => { if (active) setResult({ path, version, data }); },
      (e: Error) => { if (active) setResult({ path, version, error: e.message }); },
    );
    return () => { active = false; };
  }, [path, version]);
  const current = result?.path === path ? result : undefined;
  return {
    data: current?.data, error: current?.version === version ? current?.error : undefined,
    loading: !!path && current?.version !== version, reload: () => setVersion(value => value + 1),
  };
}

export function useTransportAction() {
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(action: string, payload: unknown, success: (data: T) => void) {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError('');
    try { success(await transportWrite<T>(action, payload)); }
    catch (e) { setError((e as Error).message); }
    finally { working.current = false; setBusy(false); }
  }
  return { busy, error, clear: () => setError(''), run };
}
