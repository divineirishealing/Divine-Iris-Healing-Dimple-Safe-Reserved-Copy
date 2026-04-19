/** Read a numeric % from GET /api/settings; 0 is valid (do not treat as missing). */
export function parseIndiaSitePercent(settingsResponse, key, fallback) {
  if (!settingsResponse || typeof settingsResponse !== 'object') return fallback;
  if (!Object.prototype.hasOwnProperty.call(settingsResponse, key)) return fallback;
  const n = Number(settingsResponse[key]);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * India manual / UPI checkout math — aligned with IndiaPaymentPage (discount on net after cart promos, then GST + platform on taxable base).
 * @param {number} effectiveBase - Amount after cart subtotal minus promo and automatic cart discounts (INR).
 * @param {object|null} clientPricing - From GET /api/student/home `client_india_pricing`.
 * @param {object} settings - Site settings: india_alt_discount_percent, india_gst_percent, india_platform_charge_percent.
 * @returns {object|null} null if effectiveBase <= 0
 */
export function computeIndiaCheckoutBreakdown(effectiveBase, clientPricing, settings) {
  const base = Number(effectiveBase);
  if (!Number.isFinite(base) || base <= 0) return null;

  const s = settings || {};
  const platformPctN = parseIndiaSitePercent(s, 'india_platform_charge_percent', 3);
  const altDiscN = parseIndiaSitePercent(s, 'india_alt_discount_percent', 9);
  const siteGstN = parseIndiaSitePercent(s, 'india_gst_percent', 18);

  const cp = clientPricing || {};
  const rawDisc = cp.india_discount_percent;
  const hasClientDiscount = rawDisc != null && rawDisc !== '';
  const discountPct = hasClientDiscount ? Number(rawDisc) : altDiscN;

  const taxEnabled = clientPricing ? !!cp.india_tax_enabled : true;
  const gstPct = !taxEnabled
    ? 0
    : cp.india_tax_enabled
      ? Number(cp.india_tax_percent) || siteGstN
      : siteGstN;
  const taxLabel = String(cp.india_tax_label || 'GST').trim() || 'GST';

  const discountLabel = hasClientDiscount ? 'India discount' : 'Alt. payment discount';

  const discountAmt = (base * (Number(discountPct) || 0)) / 100;
  const taxableBase = Math.max(0, base - discountAmt);
  const gstAmount = (taxableBase * gstPct) / 100;
  const platformAmount = (taxableBase * platformPctN) / 100;
  const finalTotal = taxableBase + gstAmount + platformAmount;
  const roundedTotal = Math.round(finalTotal);

  return {
    discountPct: Number(discountPct) || 0,
    discountLabel,
    discountAmt,
    taxableBase,
    gstPct,
    taxLabel,
    gstAmount,
    platformPct: platformPctN,
    platformAmount,
    finalTotal,
    roundedTotal,
  };
}
