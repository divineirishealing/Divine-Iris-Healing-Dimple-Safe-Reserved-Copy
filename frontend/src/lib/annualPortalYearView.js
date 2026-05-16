import {
  buildHomeComingCycles,
  orderHomeComingCyclesForAdminTable,
  utcCalendarYmd,
} from './homeComingAnnual';
import { formatDateDdMonYyyy } from './utils';

const RENEWAL_WARN_DAYS = 15;

/** Lifecycle label for a fixed start/end window (year-tab historical view). */
export function lifecycleFromAnnualWindow(startYmd, endYmd) {
  const start = (startYmd || '').trim().slice(0, 10);
  const end = (endYmd || '').trim().slice(0, 10);
  const base = { start_date: start || null, end_date: end || null, window_source: 'year_tab' };
  if (!end) {
    return { status: 'no_end_date', label: 'No end date', days_until_end: null, ...base };
  }
  const today = utcCalendarYmd();
  const t = new Date(`${today}T12:00:00Z`).getTime();
  const e = new Date(`${end}T12:00:00Z`).getTime();
  if (Number.isNaN(e)) {
    return { status: 'no_end_date', label: 'No end date', days_until_end: null, ...base };
  }
  const daysLeft = Math.round((e - t) / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) {
    return { status: 'expired', label: 'Lapsed', days_until_end: daysLeft, ...base };
  }
  if (daysLeft <= RENEWAL_WARN_DAYS) {
    return { status: 'renewal_due', label: 'Renewal due', days_until_end: daysLeft, ...base };
  }
  return { status: 'active', label: 'Active', days_until_end: daysLeft, ...base };
}

function cycleForYearOrdinal(client, yearOrdinal) {
  const cycles = orderHomeComingCyclesForAdminTable(buildHomeComingCycles(client));
  return cycles.find((c) => c.yearOrdinal === yearOrdinal) || null;
}

/** Tabs: current roster + Year 1 … Year N from all members' cycles. */
export function buildAnnualPortalYearTabs(rows) {
  let maxOrd = 0;
  for (const r of rows || []) {
    const cycles = orderHomeComingCyclesForAdminTable(buildHomeComingCycles(r));
    for (const c of cycles) {
      if (c.yearOrdinal > maxOrd) maxOrd = c.yearOrdinal;
    }
  }
  const tabs = [{ id: 'current', label: 'Current roster', shortLabel: 'Current' }];
  for (let n = 1; n <= maxOrd; n += 1) {
    const { title } = yearTabTitleFromRoster(rows, n);
    tabs.push({ id: String(n), label: title, shortLabel: `Year ${n}`, yearOrdinal: n });
  }
  return tabs;
}

export function yearTabTitleFromRoster(rows, yearOrdinal) {
  const samples = [];
  for (const r of rows || []) {
    const c = cycleForYearOrdinal(r, yearOrdinal);
    if (c && ((c.start || '').trim() || (c.end || '').trim())) samples.push(c);
  }
  samples.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
  const pick = samples[0];
  if (!pick) return { title: `Year ${yearOrdinal}`, range: '' };
  const a = formatDateDdMonYyyy(pick.start) || '—';
  const b = formatDateDdMonYyyy(pick.end) || '—';
  const range = `${a} – ${b}`;
  return { title: `Year ${yearOrdinal} · ${range}`, range };
}

/**
 * Overlay client row for a year tab (ordinal 1 = oldest window on file).
 * Returns null if this member has no window for that year.
 */
export function annualPortalRowForYearOrdinal(client, yearOrdinal) {
  const cycle = cycleForYearOrdinal(client, yearOrdinal);
  if (!cycle) return null;
  const sub = client?.annual_subscription || {};
  const lifecycle = lifecycleFromAnnualWindow(cycle.start, cycle.end);
  return {
    ...client,
    _annualYearTabOrdinal: yearOrdinal,
    _annualYearTabIsHistorical: !cycle.isCurrent,
    annual_portal_lifecycle: lifecycle,
    annual_subscription: {
      ...sub,
      start_date: cycle.start || '',
      end_date: cycle.end || '',
      annual_diid: cycle.annualDiid || sub.annual_diid || '',
    },
  };
}

export function defaultTargetIrisYearForRenew(client) {
  const sub = client?.subscription || {};
  const iy = parseInt(String(sub.iris_year ?? ''), 10);
  if (Number.isFinite(iy) && iy >= 1) return Math.min(12, iy + 1);
  const cycles = orderHomeComingCyclesForAdminTable(buildHomeComingCycles(client));
  const maxOrd = cycles.reduce((m, c) => Math.max(m, c.yearOrdinal || 0), 0);
  return Math.min(12, Math.max(1, maxOrd + 1));
}
