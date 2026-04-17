import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const POP_KEY = 'dih_dash_history_pop';

function scrollStorageKey(pathname) {
  return `dih_dash_scroll_${pathname}`;
}

/**
 * Persists window scroll per dashboard pathname and restores it after history back/forward
 * (popstate / bfcache), so returning from sub-routes or external pages keeps scroll position.
 */
export function useDashboardScrollSession() {
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith('/dashboard');

  useEffect(() => {
    const onPop = () => {
      try {
        sessionStorage.setItem(POP_KEY, '1');
      } catch (_) {
        /* ignore */
      }
    };
    const onPageShow = (e) => {
      if (e.persisted) {
        try {
          sessionStorage.setItem(POP_KEY, '1');
        } catch (_) {
          /* ignore */
        }
      }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isDashboard) return;
    let shouldRestore = false;
    try {
      if (sessionStorage.getItem(POP_KEY) === '1') {
        sessionStorage.removeItem(POP_KEY);
        shouldRestore = true;
      }
    } catch (_) {
      /* ignore */
    }
    if (!shouldRestore) return;

    let raw = null;
    try {
      raw = sessionStorage.getItem(scrollStorageKey(pathname));
    } catch (_) {
      /* ignore */
    }
    if (raw == null) return;
    const y = parseInt(raw, 10);
    if (Number.isNaN(y)) return;

    const apply = () => window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
  }, [pathname, isDashboard]);

  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!isDashboard) return;
    let t;
    const persist = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const p = pathRef.current;
          if (!p.startsWith('/dashboard')) return;
          sessionStorage.setItem(scrollStorageKey(p), String(window.scrollY || window.pageYOffset || 0));
        } catch (_) {
          /* ignore */
        }
      }, 120);
    };
    persist();
    window.addEventListener('scroll', persist, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', persist);
      try {
        const p = pathRef.current;
        if (p.startsWith('/dashboard')) {
          sessionStorage.setItem(scrollStorageKey(p), String(window.scrollY || window.pageYOffset || 0));
        }
      } catch (_) {
        /* ignore */
      }
    };
  }, [pathname, isDashboard]);
}
