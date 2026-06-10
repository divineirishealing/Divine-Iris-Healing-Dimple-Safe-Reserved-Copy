/** Bookable slots for one calendar date: per-date override → global defaults → session fallback. */
export function timeSlotsForCalendarDate(calendar, dateStr, sessionFallback = []) {
  const key = String(dateStr || '').trim().slice(0, 10);
  if (!key) return Array.isArray(sessionFallback) ? sessionFallback : [];

  const perDate = calendar?.date_time_slots;
  if (perDate && typeof perDate === 'object' && !Array.isArray(perDate)) {
    const custom = perDate[key];
    if (Array.isArray(custom)) {
      const slots = custom.map((s) => String(s).trim()).filter(Boolean);
      if (slots.length) return slots;
    }
  }

  const globalSlots = calendar?.time_slots;
  if (Array.isArray(globalSlots)) {
    const slots = globalSlots.map((s) => String(s).trim()).filter(Boolean);
    if (slots.length) return slots;
  }

  return Array.isArray(sessionFallback) ? sessionFallback : [];
}

export function formatSessionCalendarDateLabel(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
