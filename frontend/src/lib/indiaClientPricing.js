/** Read a numeric % from GET /api/settings; 0 is valid (do not treat as missing). */
export function parseIndiaSitePercent(settingsResponse, key, fallback) {
  if (!settingsResponse || typeof settingsResponse !== 'object') return fallback;
  if (!Object.prototype.hasOwnProperty.call(settingsResponse, key)) return fallback;
  const n = Number(settingsResponse[key]);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolved India discount rule before GST (member bands, flat client %, or site alt %).
 * Band rules are exclusive: first matching [min,max] wins; use either % or fixed INR on that band.
 *
 * @param {object|null} clientPricing
 * @param {number} memberCount
 * @param {number} siteAltPercent
 */
export function resolveIndiaDiscountRule(clientPricing, memberCount, siteAltPercent) {
  const cp = clientPricing || {};
  const bands = cp.india_discount_member_bands;
  const n = Math.max(0, Math.floor(Number(memberCount)));
  if (Array.isArray(bands) && bands.length > 0) {
    for (const b of bands) {
      const lo = Math.max(0, Math.floor(Number(b.min)));
      const hi = b.max == null ? lo : Math.max(lo, Math.floor(Number(b.max)));
      if (n < lo || n > hi) continue;

      const amtRaw = b.amount ?? b.amount_inr;
      if (amtRaw != null && amtRaw !== '' && Number(amtRaw) > 0) {
        return {
          fromBand: true,
          mode: 'amount',
          amountInr: Number(amtRaw),
          percent: 0,
          label: 'Group discount',
        };
      }
      const p = b.percent;
      if (p != null && p !== '' && Number.isFinite(Number(p)) && Number(p) >= 0) {
        return {
          fromBand: true,
          mode: 'percent',
          amountInr: 0,
          percent: Number(p),
          label: 'Group discount',
        };
      }
    }
  }

  const rawDisc = cp.india_discount_percent;
  const hasClientDiscount = rawDisc != null && rawDisc !== '';
  if (hasClientDiscount) {
    return {
      fromBand: false,
      mode: 'percent',
      amountInr: 0,
      percent: Number(rawDisc) || 0,
      label: 'India discount',
    };
  }
  return {
    fromBand: false,
    mode: 'percent',
    amountInr: 0,
    percent: Number(siteAltPercent) || 0,
    label: 'Alt. payment discount',
  };
}

/**
 * @deprecated Use resolveIndiaDiscountRule — kept for narrow compatibility (percent-only).
 */
export function resolveIndiaDiscountPercent(clientPricing, memberCount, siteAltPercent) {
  const r = resolveIndiaDiscountRule(clientPricing, memberCount, siteAltPercent);
  const discountPct =
    r.mode === 'amount' && r.amountInr > 0
      ? 0
      : Number(r.percent) || 0;
  return { discountPct, fromBand: r.fromBand };
}

/**
 * Apply resolved rule to an INR base (after cart promos).
 */
export function applyIndiaDiscountRuleToBase(base, rule) {
  const b = Math.max(0, Number(base));
  if (!Number.isFinite(b) || b <= 0) {
    return {
      discountAmt: 0,
      discountKind: 'percent',
      discountNominalPercent: 0,
      discountPctEffective: 0,
    };
  }
  if (rule.mode === 'amount' && rule.amountInr > 0) {
    const discountAmt = Math.min(b, rule.amountInr);
    const discountPctEffective = b > 0 ? (discountAmt / b) * 100 : 0;
    return {
      discountAmt,
      discountKind: 'amount',
      discountNominalPercent: null,
      discountPctEffective,
    };
  }
  const pct = Number(rule.percent) || 0;
  const discountAmt = (b * pct) / 100;
  return {
    discountAmt,
    discountKind: 'percent',
    discountNominalPercent: pct,
    discountPctEffective: pct,
  };
}

/**
 * India manual / UPI checkout math — aligned with IndiaPaymentPage (discount on net after cart promos, then GST + platform on taxable base).
 * @param {number} effectiveBase - Amount after cart subtotal minus promo and automatic cart discounts (INR).
 * @param {object|null} clientPricing - From GET /api/student/home `client_india_pricing`.
 * @param {object} settings - Site settings: india_alt_discount_percent, india_gst_percent, india_platform_charge_percent.
 * @param {number} [memberCount] - Total participants; when set, applies `india_discount_member_bands` if configured.
 * @returns {object|null} null if effectiveBase <= 0
 */
export function computeIndiaCheckoutBreakdown(effectiveBase, clientPricing, settings, memberCount) {
  const base = Number(effectiveBase);
  if (!Number.isFinite(base) || base <= 0) return null;

  const s = settings || {};
  const platformPctN = parseIndiaSitePercent(s, 'india_platform_charge_percent', 3);
  const altDiscN = parseIndiaSitePercent(s, 'india_alt_discount_percent', 9);
  const siteGstN = parseIndiaSitePercent(s, 'india_gst_percent', 18);

  const cp = clientPricing || {};
  const mcRaw =
    memberCount != null && memberCount !== '' ? Number(memberCount) : NaN;

  let rule;
  if (Number.isFinite(mcRaw)) {
    rule = resolveIndiaDiscountRule(cp, mcRaw, altDiscN);
  } else {
    const rawDisc = cp.india_discount_percent;
    const hasClientDiscount = rawDisc != null && rawDisc !== '';
    rule = hasClientDiscount
      ? {
          fromBand: false,
          mode: 'percent',
          amountInr: 0,
          percent: Number(rawDisc) || 0,
          label: 'India discount',
        }
      : {
          fromBand: false,
          mode: 'percent',
          amountInr: 0,
          percent: Number(altDiscN) || 0,
          label: 'Alt. payment discount',
        };
  }

  const applied = applyIndiaDiscountRuleToBase(base, rule);
  const discountAmt = applied.discountAmt;
  const discountLabel = rule.label;

  const taxEnabled = clientPricing ? !!cp.india_tax_enabled : true;
  const gstPct = !taxEnabled
    ? 0
    : cp.india_tax_enabled
      ? Number(cp.india_tax_percent) || siteGstN
      : siteGstN;
  const taxLabel = String(cp.india_tax_label || 'GST').trim() || 'GST';

  const taxableBase = Math.max(0, base - discountAmt);
  const gstAmount = (taxableBase * gstPct) / 100;
  const platformAmount = (taxableBase * platformPctN) / 100;
  const finalTotal = taxableBase + gstAmount + platformAmount;
  const roundedTotal = Math.round(finalTotal);

  return {
    discountKind: applied.discountKind,
    discountNominalPercent: applied.discountNominalPercent,
    discountPct: applied.discountPctEffective,
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
