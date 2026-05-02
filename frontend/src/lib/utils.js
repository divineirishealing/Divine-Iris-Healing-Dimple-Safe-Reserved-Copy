import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const DASH_MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse YYYY-MM-DD, ISO string, or Date to local calendar Date (noon). */
function parseDashboardDateInput(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = val.getMonth();
    const d = val.getDate();
    return new Date(y, m, d, 12, 0, 0, 0);
  }
  const s = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const t = new Date(y, m - 1, d, 12, 0, 0, 0);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const t = new Date(`${s}T12:00:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Display API / ISO dates (YYYY-MM-DD) as dd-mm-yyyy (legacy / non-dashboard). */
export function formatDateDdMmYyyy(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }
  const t = new Date(`${s}T12:00:00`);
  if (!Number.isNaN(t.getTime())) {
    const dd = String(t.getDate()).padStart(2, "0");
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const yy = t.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  return "";
}

/**
 * Dashboard display dates: `14-Apr-2026` (two-digit day, English short month, four-digit year).
 * Accepts YYYY-MM-DD or ISO strings; uses local calendar date.
 */
export function formatDateDdMonYyyy(val) {
  const t = parseDashboardDateInput(val);
  if (!t) return "";
  const day = String(t.getDate()).padStart(2, "0");
  const mon = DASH_MONS[t.getMonth()];
  return `${day}-${mon}-${t.getFullYear()}`;
}

/**
 * Admin program batch / enrollments: `3-MAY-2026` (no leading zero on day, month uppercase).
 * Accepts YYYY-MM-DD or ISO date strings; uses local calendar date.
 */
export function formatDateDMonYyyyUpper(val) {
  const t = parseDashboardDateInput(val);
  if (!t) return "";
  const day = String(t.getDate());
  const mon = DASH_MONS[t.getMonth()].toUpperCase();
  return `${day}-${mon}-${t.getFullYear()}`;
}

/**
 * Timestamp with same date style as {@link formatDateDMonYyyyUpper}: `3-MAY-2026, 14:05` (local).
 */
export function formatDateTimeDMonYyyyUpper(val) {
  if (val == null || val === "") return "—";
  const t = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(t.getTime())) return "—";
  const y = t.getFullYear();
  const mo = t.getMonth();
  const d = t.getDate();
  const day = String(d);
  const mon = DASH_MONS[mo].toUpperCase();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${day}-${mon}-${y}, ${hh}:${mm}`;
}

/**
 * Timestamp for admin / activity rows: `26-Apr-2026, 14:05` (local date + 24h time).
 */
export function formatDateTimeDdMonYyyy(val) {
  if (val == null || val === "") return "—";
  const t = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(t.getTime())) return "—";
  const y = t.getFullYear();
  const mo = t.getMonth();
  const d = t.getDate();
  const day = String(d).padStart(2, "0");
  const mon = DASH_MONS[mo];
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${day}-${mon}-${y}, ${hh}:${mm}`;
}

/** Schedule time: single line, trimmed; use em dash when empty (matches date cells). */
export function formatDashboardTime(val) {
  if (val == null || val === "") return "—";
  const t = String(val).trim().replace(/\s+/g, " ");
  return t || "—";
}

/** Stat cards / labels: ISO → dd-Mon-yyyy; pass through non-date phrases (e.g. "No pending dues"). */
export function formatDashboardStatDate(val) {
  if (val == null || val === "") return "—";
  const s = String(val).trim();
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    return formatDateDdMonYyyy(head) || "—";
  }
  return s || "—";
}

/**
 * Subscription / package validity end: add months with day-30 anchor rule.
 * Uses UTC calendar components so YYYY-MM-DD matches backend and avoids `toISOString()` day shifts.
 */
export function addMonthsSubscriptionEnd(dateStr, months) {
  if (!dateStr || !String(dateStr).trim()) return "";
  const m = parseInt(months, 10);
  const monthsAdd = Number.isFinite(m) && m > 0 ? m : 12;
  const ds = String(dateStr).trim().slice(0, 10);
  const parts = ds.split("-");
  if (parts.length !== 3) return "";
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return "";
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (Number.isNaN(d.getTime())) return "";
  const targetMonth = d.getUTCMonth() + monthsAdd;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const actualMonth = ((targetMonth % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, actualMonth + 1, 0)).getUTCDate();
  let end;
  if (daysInMonth >= 30) {
    end = new Date(Date.UTC(targetYear, actualMonth, 30));
  } else {
    const spillDays = 30 - daysInMonth;
    const jsMonthNext = actualMonth + 1;
    const jsYear = targetYear + Math.floor(jsMonthNext / 12);
    const jsMonthFinal = jsMonthNext % 12;
    end = new Date(Date.UTC(jsYear, jsMonthFinal, spillDays));
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`;
}

/**
 * Add whole calendar months to a YYYY-MM-DD anchor (UTC), for Sacred Home renewal starts
 * (e.g. 2025-05-03 + 12 → 2026-05-03). Invalid days in the target month roll the way `Date` does in JS.
 */
export function addCalendarMonthsYmd(dateStr, monthsToAdd) {
  if (!dateStr || !String(dateStr).trim()) return "";
  const mAdd = parseInt(monthsToAdd, 10);
  const n = Number.isFinite(mAdd) ? mAdd : 0;
  if (n === 0) return String(dateStr).trim().slice(0, 10);
  const ds = String(dateStr).trim().slice(0, 10);
  const parts = ds.split("-");
  if (parts.length !== 3) return "";
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return "";
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCMonth(d.getUTCMonth() + n);
  const pad2 = (x) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Sacred Home annual bundle end (membership window): use day `min(30, daysInMonth)` in the calendar month
 * immediately before the anniversary month of `start + months` (same calendar roll as `addMonthsSubscriptionEnd`).
 * Example: start `2026-05-03`, 12 months → anniversary May 2027 → bundle end `2027-04-30`.
 */
export function addMonthsAnnualBundleEnd(dateStr, months) {
  if (!dateStr || !String(dateStr).trim()) return "";
  const m = parseInt(months, 10);
  const monthsAdd = Number.isFinite(m) && m > 0 ? m : 12;
  const ds = String(dateStr).trim().slice(0, 10);
  const parts = ds.split("-");
  if (parts.length !== 3) return "";
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return "";
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (Number.isNaN(d.getTime())) return "";
  const annivMonthIndex = d.getUTCMonth() + monthsAdd;
  const annivYear = d.getUTCFullYear() + Math.floor(annivMonthIndex / 12);
  const annivMonth = ((annivMonthIndex % 12) + 12) % 12;
  let prevMonth = annivMonth - 1;
  let prevYear = annivYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const daysInPrev = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
  const dom = Math.min(30, daysInPrev);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${prevYear}-${pad2(prevMonth + 1)}-${pad2(dom)}`;
}

/**
 * Next local calendar date (YYYY-MM-DD) on or after `from`, whose day-of-month is `dom`.
 * Used for optional membership start anchored to e.g. the 3rd of each month. `dom` is clamped 1–28.
 */
export function nextDateWithDayOfMonth(from, dom) {
  const n = Math.floor(Number(dom));
  if (!Number.isFinite(n) || n < 1 || n > 28) return "";
  const start = parseDashboardDateInput(from);
  const base = start || new Date();
  base.setHours(12, 0, 0, 0);
  const pad2 = (x) => String(x).padStart(2, "0");
  for (let addM = 0; addM < 48; addM += 1) {
    const x = new Date(base.getFullYear(), base.getMonth() + addM, 1, 12, 0, 0, 0);
    const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    const day = Math.min(n, dim);
    const cand = new Date(x.getFullYear(), x.getMonth(), day, 12, 0, 0, 0);
    if (cand >= base) {
      return `${cand.getFullYear()}-${pad2(cand.getMonth() + 1)}-${pad2(cand.getDate())}`;
    }
  }
  return "";
}

/**
 * Sacred Exchange EMI Schedule typography — reuse for My Programs tables and other dashboard grids.
 * Body text-sm; headers uppercase 10px gray-400; dates/amounts tabular-nums (dashboard uses Lato).
 */
export const dashboardEmiTable = {
  wrap: "overflow-x-auto",
  table: "w-full text-sm border-collapse",
  theadRow: "text-[10px] uppercase tracking-wider text-gray-400 border-b",
  th: "text-left py-2 px-2",
  thRight: "text-right py-2 px-2",
  thCenter: "text-center py-2 px-2",
  tbodyTr: "border-b border-gray-50 hover:bg-gray-50",
  td: "py-3 px-2",
  tdNum: "py-3 px-2 font-medium text-gray-700",
  tdDate: "py-3 px-2 tabular-nums text-sm text-gray-700 whitespace-nowrap",
  tdAmount: "py-3 px-2 text-right tabular-nums text-sm text-gray-700",
  tdSmallCenter: "py-3 px-2 text-center text-[10px] text-gray-500",
  tdRemarks: "py-3 px-2 text-left text-[10px] text-gray-400 max-w-[120px] truncate",
};

/** Student home (dark) schedule table — same structure as EMI (10px headers, sm body, mono dates). */
export const dashboardStudentScheduleTable = {
  table: "w-full min-w-[320px] text-left text-sm border-collapse",
  theadRow: "text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200",
  th: "pb-2 px-1 font-semibold text-left",
  thRight: "pb-2 px-1 font-semibold text-right whitespace-nowrap",
  td: "py-2 px-1 align-middle",
  tdDate: "py-2 px-1 align-middle tabular-nums text-sm text-slate-800 whitespace-nowrap",
  tdTime: "py-2 px-1 align-middle tabular-nums text-sm text-slate-600",
  tdProgram: "py-2 px-1 align-middle text-slate-800 font-medium text-sm max-w-[100px] truncate",
};
