import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl, isUploadApiReachable } from '../lib/config';

const API = getApiUrl();

/**
 * Records anonymous pathname views to the backend (admin-only reports).
 * Skips /admin, skips when API URL is not configured, ignores failures.
 */
export default function PageAnalyticsBeacon() {
  const location = useLocation();
  const lastSent = useRef('');

  useEffect(() => {
    if (!isUploadApiReachable()) return;
    const path = `${location.pathname || '/'}`;
    if (path.toLowerCase().startsWith('/admin')) return;
    const key = `${path}|${location.search || ''}`;
    if (lastSent.current === key) return;
    lastSent.current = key;

    const referrer = typeof document !== 'undefined' ? (document.referrer || '') : '';
    axios
      .post(
        `${API}/analytics/collect`,
        { path, referrer },
        { timeout: 8000 },
      )
      .catch(() => {});
  }, [location.pathname, location.search]);

  return null;
}
