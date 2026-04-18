/** Tier index for flagship programs: prefer annual tier for annual subscribers, else first tier. */
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
 * Cart line for an annual package–included program must not go through combined Review & pay
 * (use per-program “Continue to enrollment & payment” instead).
 */
export function isAnnualPackageIncludedCartLine(item, configuredIds) {
  if (!item || item.type !== 'program') return false;
  if (item.portalLineMeta?.annualIncluded) return true;
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
