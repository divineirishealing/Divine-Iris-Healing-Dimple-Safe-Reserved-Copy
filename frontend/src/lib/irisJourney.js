/**
 * Client-side mirror of backend iris_journey logic for admin table display.
 * Labels come from API catalog when available.
 */

/** Year number → titles (must stay aligned with backend `iris_journey.py` IRIS_JOURNEY_YEARS). */
export const IRIS_JOURNEY_PARTS = {
  1: { title: 'Iris Essence', subtitle: 'The Presence' },
  2: { title: 'Iris Alchemy', subtitle: 'The Transformation' },
  3: { title: 'Iris Magic', subtitle: 'The Enchantment' },
  4: { title: 'Iris Zenith', subtitle: 'The Illumination' },
  5: { title: 'Iris Ether', subtitle: 'The Integration' },
  6: { title: 'Iris Infinity', subtitle: 'The Eternal' },
  7: { title: 'Iris Nirvana', subtitle: 'The Transcendence' },
  8: { title: 'Iris Mandala', subtitle: 'The Harmony' },
  9: { title: 'Iris Lumina', subtitle: 'The Pure Light' },
  10: { title: 'Iris Source', subtitle: 'The Divine Origin' },
  11: { title: 'Iris Aurora', subtitle: 'The New Dawn' },
  12: { title: 'Iris Stellaria', subtitle: 'The Cosmic Legacy' },
};

/** Full label with trailing period, matching `resolve_iris_journey` / garden labels. */
export function formatIrisYearLabel(year) {
  const y = Math.min(12, Math.max(1, parseInt(year, 10) || 1));
  const p = IRIS_JOURNEY_PARTS[y];
  if (!p) return `Year ${y}.`;
  return `Year ${y}: ${p.title} — ${p.subtitle}.`;
}

/** Strip trailing period for prose (e.g. mid-sentence). */
export function irisYearLabelNoPeriod(year) {
  return String(formatIrisYearLabel(year)).replace(/\.\s*$/, '').trim();
}

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
