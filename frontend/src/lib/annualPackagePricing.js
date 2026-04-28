/** Catalog fallback when a currency has no explicit tax_rates entry — 0 = no tax (set per currency in the row above). */
const DEFAULT_TAX_DECIMAL = { INR: 0, AED: 0, USD: 0 };

export function packageTaxDecimal(pkg, currency) {
  const cur = currency || 'INR';
  const tr = pkg?.tax_rates || {};
  if (tr[cur] != null && tr[cur] !== '') return Number(tr[cur]) || 0;
  return DEFAULT_TAX_DECIMAL[cur] ?? 0;
}

/** ISO date YYYY-MM-DD within package valid_from / valid_to (inclusive); empty bounds = open. */
export function packageValidForStartDate(pkg, startDateStr) {
  if (!startDateStr || !String(startDateStr).trim()) return true;
  const d = String(startDateStr).trim().slice(0, 10);
  const from = (pkg?.valid_from || '').slice(0, 10);
  const to = (pkg?.valid_to || '').slice(0, 10);
  if (!from && !to) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
