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
