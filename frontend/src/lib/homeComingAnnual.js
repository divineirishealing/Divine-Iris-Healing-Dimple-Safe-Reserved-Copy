/** Home Coming — single annual SKU for Client Garden (entitlements + API value). */

export const HOME_COMING_SKU = 'home_coming';
export const HOME_COMING_DISPLAY = 'Home Coming';

/** Included in Home Coming: 12 mo AWRP, 6 mo MMM, 4 Turbo (quarterly), 2 Meta (bi-annual). */
export const HOME_COMING_ENTITLEMENTS = {
  awrp_months: 12,
  mmm_months: 6,
  turbo_sessions: 4,
  meta_downloads: 2,
};

function nameInitialsFour(name) {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = (w) => w.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (parts.length >= 2) {
    const a = letters(parts[0]).slice(0, 2).padEnd(2, 'X');
    const b = letters(parts[parts.length - 1]).slice(0, 2).padEnd(2, 'X');
    return (a + b).slice(0, 4);
  }
  if (parts.length === 1) {
    const p = letters(parts[0]);
    return (p + 'XXXX').slice(0, 4);
  }
  return 'XXXX';
}

/**
 * Suggested annual DIID: FFLl + YYMM from subscription start (matches backend name rules).
 * @param {string} name
 * @param {string} yyyyMmDd YYYY-MM-DD
 */
export function suggestAnnualDiidFromName(name, yyyyMmDd) {
  if (!yyyyMmDd || yyyyMmDd.length < 8) return '';
  const d = new Date(`${yyyyMmDd.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const yy = d.getUTCFullYear() % 100;
  const mm = d.getUTCMonth() + 1;
  return `${nameInitialsFour(name)}${String(yy).padStart(2, '0')}${String(mm).padStart(2, '0')}`;
}

export function formatHomeComingUsageSummary(sub) {
  const u = sub?.usage || {};
  const e = HOME_COMING_ENTITLEMENTS;
  return [
    `AWRP ${u.awrp_months_used ?? 0}/${e.awrp_months}`,
    `MMM ${u.mmm_months_used ?? 0}/${e.mmm_months}`,
    `Turbo ${u.turbo_sessions_used ?? 0}/${e.turbo_sessions}`,
    `Meta ${u.meta_downloads_used ?? 0}/${e.meta_downloads}`,
  ].join(' · ');
}
