/** Home Coming — single annual SKU for Client Garden (entitlements + API value). */

export const HOME_COMING_SKU = 'home_coming';
export const HOME_COMING_DISPLAY = 'Home Coming';

/** Included in Home Coming: 12 mo AWRP, 6 mo MMM, 4 Turbo Release, 2 Meta Downloads. */
export const HOME_COMING_ENTITLEMENTS = {
  awrp_months: 12,
  mmm_months: 6,
  turbo_sessions: 4,
  meta_downloads: 2,
};

/** Slot counts per pillar (matches backend ``_HOME_COMING_PROGRAM_SLOTS``). */
export const HOME_COMING_PROGRAM_SLOTS = {
  awrp: HOME_COMING_ENTITLEMENTS.awrp_months,
  mmm: HOME_COMING_ENTITLEMENTS.mmm_months,
  turbo: HOME_COMING_ENTITLEMENTS.turbo_sessions,
  meta: HOME_COMING_ENTITLEMENTS.meta_downloads,
};

/** Four pillars (matches `/api/student/home` `home_coming.includes` for dashboards and tooltips). */
export const HOME_COMING_INCLUDES = [
  { id: 'awrp', short: 'AWRP', summary: '12 months · Atomic Weight Release Program' },
  { id: 'mmm', short: 'MMM', summary: '6 months · Money Magic Multiplier' },
  { id: 'turbo', short: 'Turbo Release', summary: '4 Turbo Release sessions' },
  { id: 'meta', short: 'Meta Downloads', summary: '2 Meta Downloads sessions' },
];

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

function newSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `hc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Empty grid rows (admin source) for the current Home Coming year — fill dates manually or use “Sync from program schedule”. */
export function buildHomeComingSessionSkeleton() {
  const rows = [];
  const add = (program, max) => {
    for (let slot = 1; slot <= max; slot += 1) {
      rows.push({
        id: newSessionId(),
        program,
        slot,
        date: '',
        time: '',
        paused: false,
        source: 'admin',
      });
    }
  };
  add('awrp', HOME_COMING_PROGRAM_SLOTS.awrp);
  add('mmm', HOME_COMING_PROGRAM_SLOTS.mmm);
  add('turbo', HOME_COMING_PROGRAM_SLOTS.turbo);
  add('meta', HOME_COMING_PROGRAM_SLOTS.meta);
  return rows;
}

const PROG_ORDER = { awrp: 0, mmm: 1, turbo: 2, meta: 3 };

function sortSessionsList(list) {
  return [...(list || [])].sort(
    (a, b) =>
      (PROG_ORDER[a.program] ?? 9) - (PROG_ORDER[b.program] ?? 9) || (a.slot || 0) - (b.slot || 0),
  );
}

/**
 * Prior ledger windows + current ``annual_subscription`` for expand/collapse UI.
 * @param {object} client — API client row (annual_subscription, annual_period_ledger)
 */
export function buildHomeComingCycles(client) {
  const sub = client?.annual_subscription || {};
  const ledger = [...(client?.annual_period_ledger || [])].sort((a, b) =>
    String(a.start_date || '').localeCompare(String(b.start_date || '')),
  );

  const cycles = [];
  for (const e of ledger) {
    cycles.push({
      ledgerId: e.id || null,
      start: e.start_date || '',
      end: e.end_date || '',
      sessions: sortSessionsList(e.home_coming_sessions || []),
      isCurrent: false,
    });
  }
  if ((sub.start_date || '').trim() || (sub.end_date || '').trim() || (sub.home_coming_sessions || []).length) {
    cycles.push({
      ledgerId: null,
      start: sub.start_date || '',
      end: sub.end_date || '',
      sessions: sortSessionsList(sub.home_coming_sessions || []),
      isCurrent: true,
    });
  }
  return cycles;
}

export function homeComingSessionAttendLabel(sess) {
  if (sess?.paused) return 'Paused';
  if (sess?.attended === true) return 'Attended';
  if (sess?.attended === false) return 'Not attended';
  return 'Expected';
}

export function summarizeHomeComingSessions(sessions) {
  const list = sessions || [];
  if (list.length === 0) return 'No session rows';
  const paused = list.filter((s) => s.paused).length;
  const withDate = list.filter((s) => (s.date || '').trim()).length;
  return `${withDate}/${list.length} dated${paused ? ` · ${paused} paused` : ''}`;
}
