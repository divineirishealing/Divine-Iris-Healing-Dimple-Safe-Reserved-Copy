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

function parseYmdLocal(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Open dates from the unified calendar with resolved slot lists (respects min advance & weekend rules). */
export function bookableOpenDatesWithSlots(calendar, sessionFallback = [], { monthYmd } = {}) {
  const dates = [...(calendar?.available_dates || [])].sort();
  const minAdvance = Number(calendar?.min_advance_days) >= 0 ? Number(calendar.min_advance_days) : 7;
  const blockWeekends = calendar?.block_weekends !== false;
  const blockedUntil = String(calendar?.blocked_until || '').slice(0, 10);

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + minAdvance);

  let monthFilter = null;
  if (monthYmd && /^\d{4}-\d{2}$/.test(monthYmd)) {
    const [y, m] = monthYmd.split('-').map(Number);
    monthFilter = { y, m };
  }

  return dates
    .filter((d) => {
      const dt = parseYmdLocal(d);
      if (!dt || dt < minDate) return false;
      if (blockedUntil && d <= blockedUntil) return false;
      if (blockWeekends) {
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) return false;
      }
      if (monthFilter) {
        return dt.getFullYear() === monthFilter.y && dt.getMonth() + 1 === monthFilter.m;
      }
      return true;
    })
    .map((d) => ({
      date: d,
      label: formatSessionCalendarDateLabel(d),
      slots: timeSlotsForCalendarDate(calendar, d, sessionFallback),
    }));
}

export function formatSessionCalendarDateLabel(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
