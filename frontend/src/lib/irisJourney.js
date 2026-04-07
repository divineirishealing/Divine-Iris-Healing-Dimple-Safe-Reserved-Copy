/**
 * Client-side mirror of backend iris_journey logic for admin table display.
 * Labels come from API catalog when available.
 */
export function computeAutoIrisYear(startDateStr) {
  if (!startDateStr || !String(startDateStr).trim()) return 1;
  const s = String(startDateStr).trim().slice(0, 10);
  const start = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  if (now < start) return 1;
  const deltaDays = Math.floor((now - start) / 86400000);
  const elapsed = Math.floor(deltaDays / 365);
  return Math.min(12, Math.max(1, elapsed + 1));
}

export function effectiveIrisJourneyLabel(sub, catalog) {
  const mode = (sub.iris_year_mode || 'manual').toLowerCase();
  const year = mode === 'auto'
    ? computeAutoIrisYear(sub.start_date)
    : Math.min(12, Math.max(1, parseInt(sub.iris_year, 10) || 1));
  const item = (catalog || []).find((y) => y.year === year);
  return item?.label || `Year ${year}`;
}
