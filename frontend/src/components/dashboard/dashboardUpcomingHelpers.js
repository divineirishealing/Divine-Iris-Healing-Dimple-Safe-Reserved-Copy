/**
 * Tier index for flagship programs: prefer annual-duration tier when `preferAnnualTier` (Client Garden
 * Annual access), else first tier (e.g. 1 Month). Do not use subscription-only “annual subscriber” here.
 */
export function pickTierIndexForDashboard(program, preferAnnualTier) {
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || tiers.length === 0) return null;
  if (preferAnnualTier) {
    const idx = tiers.findIndex((t) => {
      const l = (t.label || '').toLowerCase();
      return l.includes('annual') || l.includes('year') || t.duration_unit === 'year';
    });
    if (idx >= 0) return idx;
  }
  return 0;
}

/** MMM / AWRP etc. — already in annual package; member only pays for family add-ons. */
export function programIncludedInAnnualPackage(p, configuredIds) {
  const ids = Array.isArray(configuredIds)
    ? configuredIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (ids.length > 0) {
    return ids.includes(String(p.id));
  }
  const t = `${p.title || ''} ${p.category || ''}`.toLowerCase();
  return (
    t.includes('money magic') ||
    t.includes('mmm') ||
    t.includes('atomic weight') ||
    t.includes('awrp')
  );
}

/**
 * Cart line for an annual package–included program must not go through combined Divine Cart
 * (use per-program “Add to Divine Cart” instead).
 */
export function isAnnualPackageIncludedCartLine(item, configuredIds) {
  if (!item || item.type !== 'program') return false;
  const meta = item.portalLineMeta;
  /** Dashboard sets this to false for add-ons so we do not strip them via title heuristics. */
  if (meta && meta.annualIncluded === false) return false;
  if (meta?.annualIncluded === true) return true;
  return programIncludedInAnnualPackage(
    { id: item.programId, title: item.programTitle, category: item.programCategory },
    configuredIds,
  );
}

/** Same basis as EnrollmentPage promo discount: percentage of subtotal or fixed per currency. */
export function promoDiscountAmount(promoResult, subtotalRaw, currency) {
  if (!promoResult || subtotalRaw <= 0) return 0;
  if (promoResult.discount_type === 'percentage') {
    return Math.round((subtotalRaw * (Number(promoResult.discount_percentage) || 0)) / 100);
  }
  return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
}
