/** Shared deadline / early-bird date+time helpers (Pricing Hub, Upcoming Hub). */

export const HUB_TZ_TO_OFFSET = {
  IST: '+05:30',
  'GST Dubai': '+04:00',
  EST: '-05:00',
  PST: '-08:00',
  CST: '-06:00',
  MST: '-07:00',
  GMT: '+00:00',
  UTC: '+00:00',
  BST: '+01:00',
  CET: '+01:00',
  AEST: '+10:00',
  SGT: '+08:00',
  JST: '+09:00',
};

export const DEFAULT_HUB_TIME_ZONE = 'GST Dubai';

export function deadlineCalendarKey(deadline) {
  const s = (deadline || '').trim();
  if (!s) return '';
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
}

export function parseDeadlineParts(deadline) {
  const s = (deadline || '').trim();
  if (!s) return { date: '', time: '' };
  const datePart = s.includes('T') ? s.split('T')[0].slice(0, 10) : s.slice(0, 10);
  if (!s.includes('T')) return { date: datePart, time: '' };
  const afterT = s.split('T')[1] || '';
  const m = afterT.match(/^(\d{2}:\d{2})/);
  return { date: datePart, time: m ? m[1] : '' };
}

/** Date-only if time empty (legacy end-of-day on server). Otherwise ISO with hub TZ offset. */
export function mergeDeadlineDateTime(dateStr, timeStr, tzLabel) {
  const d = (dateStr || '').slice(0, 10);
  if (!d) return '';
  const t = (timeStr || '').trim();
  if (!t) return d;
  const hm = t.length >= 5 ? t.slice(0, 5) : t;
  const off = HUB_TZ_TO_OFFSET[tzLabel] || '+00:00';
  return `${d}T${hm}:00${off}`;
}
