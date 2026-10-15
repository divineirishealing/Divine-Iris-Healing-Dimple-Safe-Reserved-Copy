import { parseProgramDate } from './upcomingHomepagePresentation';

/** Count Saturday + Sunday dates between start and end (inclusive). */
export function countWeekendDaysInRange(startDate, endDate) {
  const s = parseProgramDate(startDate);
  const e = parseProgramDate(endDate);
  if (!s || !e || e < s) return 0;
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Legacy schema default — not a real program length when start/end dates are set. */
function isPlaceholderDurationText(raw) {
  const s = String(raw || '').trim();
  if (!s) return true;
  return /^90\s*days?$/i.test(s);
}

/**
 * Duration pill / card copy — honors explicit duration, weekends-only workshops, and date span.
 * @returns {string}
 */
function formatSessionDayCount(days, weekendsOnly) {
  const label = `${days} Day${days === 1 ? '' : 's'}`;
  if (weekendsOnly) return `${label} · Weekends Only`;
  return label;
}

export function resolveProgramDurationDisplay({ tier, program } = {}) {
  const weekendsOnly = tier ? !!tier.weekends_only : !!program?.weekends_only;
  const sessionDaysRaw = tier?.session_days ?? program?.session_days ?? 0;
  const sessionDays = parseInt(sessionDaysRaw, 10) || 0;
  const start = tier?.start_date || program?.start_date;
  const end = tier?.end_date || program?.end_date;
  const explicit = String(tier?.duration || program?.duration || '').trim();

  /** Admin-set live session count (e.g. 7 days on Jul 31 + Aug weekends) beats calendar span. */
  if (sessionDays > 0) {
    return formatSessionDayCount(sessionDays, weekendsOnly);
  }

  const s = parseProgramDate(start);
  const e = parseProgramDate(end);
  const calendarSpanDays =
    s && e ? Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1 : 0;

  if (explicit && !isPlaceholderDurationText(explicit)) {
    if (weekendsOnly && !/weekend/i.test(explicit)) {
      return `${explicit} · Weekends Only`;
    }
    return explicit;
  }

  if (weekendsOnly) {
    const days = countWeekendDaysInRange(start, end);
    if (days > 0) return formatSessionDayCount(days, true);
  }

  if (calendarSpanDays > 0) {
    return `${calendarSpanDays} Day${calendarSpanDays === 1 ? '' : 's'}`;
  }

  if (explicit && !isPlaceholderDurationText(explicit)) {
    return explicit;
  }

  return '';
}
