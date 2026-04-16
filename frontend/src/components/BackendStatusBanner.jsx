import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Shows a thin bar when the API health check fails (e.g. deploy / cold start).
 * Does not block the UI; GET retries still run via axiosRetry.
 */
export default function BackendStatusBanner() {
  const [visible, setVisible] = useState(false);
  const fails = useRef(0);

  useEffect(() => {
    if (!BACKEND || process.env.NODE_ENV !== 'production') return undefined;

    let cancelled = false;
    const healthUrl = `${BACKEND}/api/health`;

    const ping = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch(healthUrl, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (cancelled) return;
        if (r.ok) {
          fails.current = 0;
          setVisible(false);
        } else {
          fails.current += 1;
          if (fails.current >= 2) setVisible(true);
        }
      } catch {
        if (cancelled) return;
        fails.current += 1;
        if (fails.current >= 2) setVisible(true);
      }
    };

    ping();
    const id = setInterval(ping, 15000);
    const onVis = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[9999] flex items-center justify-center gap-2 px-3 py-2 text-center text-xs sm:text-sm font-medium text-amber-950 bg-amber-100/95 border-b border-amber-300 shadow-sm"
    >
      <WifiOff className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
      <span>
        Reconnecting to the server — if you just deployed, this usually clears in under a minute.
      </span>
      <Loader2 className="w-4 h-4 shrink-0 animate-spin opacity-70" aria-hidden />
    </div>
  );
}
