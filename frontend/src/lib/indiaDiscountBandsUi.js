/** UI rows ↔ API `india_discount_member_bands` (min/max + either percent or amount). */

export function newBandRow() {
  return {
    id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    min: '',
    max: '',
    kind: 'percent',
    value: '',
  };
}

/**
 * @param {unknown[]} bands - from client document
 * @returns {object[]} row state for IndiaDiscountBandsEditor
 */
export function serverBandsToRows(bands) {
  if (!Array.isArray(bands) || !bands.length) return [];
  return bands.map((b, i) => {
    const legacyAmt = b.amount ?? b.amount_inr;
    const hasAmt = legacyAmt != null && Number(legacyAmt) > 0;
    return {
      id: `r-${i}-${b.min}-${b.max}-${i}`,
      min: b.min ?? '',
      max: b.max ?? '',
      kind: hasAmt ? 'amount' : 'percent',
      value: hasAmt ? String(legacyAmt) : String(b.percent ?? ''),
    };
  });
}

/**
 * @param {object[]} rows - from editor
 * @returns {object[]|null} payload for API or null if no valid rules
 */
export function rowsToBandsPayload(rows) {
  const out = [];
  for (const r of rows) {
    const min = parseInt(String(r.min).trim(), 10);
    const max = parseInt(String(r.max).trim(), 10);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    if (max < min) continue;
    if (r.kind === 'amount') {
      const amt = parseFloat(String(r.value).replace(/,/g, ''));
      if (Number.isFinite(amt) && amt > 0) out.push({ min, max, amount: amt });
    } else {
      const pct = parseFloat(String(r.value).replace(/,/g, ''));
      if (Number.isFinite(pct) && pct >= 0) out.push({ min, max, percent: pct });
    }
  }
  return out.length ? out : null;
}

/**
 * @returns {string|null} error message or null if OK
 */
export function validateBandRows(rows) {
  for (const r of rows) {
    const empty = String(r.min).trim() === '' && String(r.max).trim() === '' && String(r.value).trim() === '';
    if (empty) continue;
    const min = parseInt(String(r.min).trim(), 10);
    const max = parseInt(String(r.max).trim(), 10);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return 'Each rule needs valid Min and Max (whole numbers).';
    }
    if (max < min) return 'Max must be greater than or equal to Min.';
  }
  return null;
}
