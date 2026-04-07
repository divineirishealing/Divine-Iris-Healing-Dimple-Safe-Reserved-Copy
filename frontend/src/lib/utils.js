import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Display API / ISO dates (YYYY-MM-DD) as dd-mm-yyyy (dashboard uniform). */
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

/** Schedule time: single line, trimmed; use em dash when empty (matches date cells). */
export function formatDashboardTime(val) {
  if (val == null || val === "") return "—";
  const t = String(val).trim().replace(/\s+/g, " ");
  return t || "—";
}
