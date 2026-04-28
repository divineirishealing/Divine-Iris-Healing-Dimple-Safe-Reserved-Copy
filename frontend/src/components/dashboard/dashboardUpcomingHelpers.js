/**
 * Normalize program ids for annual-package checklist matching (matches backend
 * `_canonical_site_program_id_for_annual_pkg`): trim; UUID strings compared case-insensitively.
 */
export function canonicalSiteProgramId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.length === 36 && (s.match(/-/g) || []).length === 4) {
    const m =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (m.test(s)) return s.toLowerCase();
  }
  return s;
}

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

/** True when this duration tier is year-long (Annual) — family add-ons need a separate paid tier for quoting. */
export function programTierIsYearLong(program, tierIndex) {
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || !tiers.length) return false;
  const i =
    typeof tierIndex === 'number' && tierIndex >= 0 && tierIndex < tiers.length ? tierIndex : 0;
  const t = tiers[i];
  if (!t) return false;
  const l = (t.label || '').toLowerCase();
  return l.includes('annual') || l.includes('year') || t.duration_unit === 'year';
}

/** Tier indices that are not year-long (for “family seats” duration picker). */
export function nonYearLongTierIndices(program) {
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || !tiers.length) return [];
  const out = [];
  for (let i = 0; i < tiers.length; i += 1) {
    if (!programTierIsYearLong(program, i)) out.push(i);
  }
  return out;
}

/**
 * Title/category fallback when annual package id list is empty (admin left all unchecked).
 * Must stay aligned with backend `_program_keyword_in_annual_package`.
 */
function programKeywordInAnnualPackage(p) {
  const blob = `${p?.title || ''} ${p?.category || ''}`.toLowerCase();
  const keys = ['money magic', 'mmm', 'atomic weight', 'awrp'];
  return keys.some((k) => blob.includes(k));
}

/**
 * Annual-package “included” for the booker seat: strict program ids when the admin list is non-empty,
 * unless `eligibleForAnnualPortalKeywords` reflects Sacred Home annual+dashboard access — then pillar
 * keywords still match (MMM, Atomic Weight…) when admins left a partial checklist.
 * When the list is empty: keyword fallback only.
 */
export function programIncludedInAnnualPackage(
  p,
  configuredIds,
  eligibleForAnnualPortalKeywords = false
) {
  const ids = Array.isArray(configuredIds)
    ? configuredIds.map((x) => canonicalSiteProgramId(x)).filter(Boolean)
    : [];
  const kw = programKeywordInAnnualPackage(p);
  if (ids.length > 0) {
    const byId = ids.includes(canonicalSiteProgramId(p?.id ?? p?._id));
    if (eligibleForAnnualPortalKeywords) return byId || kw;
    return byId;
  }
  return kw;
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

/**
 * Per-guest tier for portal quote: explicit `memberTierById`, else package year-long default, else UI tier.
 */
export function resolveEffectiveGuestTierForQuote(program, guestId, opts) {
  const tiers = program?.duration_tiers || [];
  const max = tiers.length;
  const id = String(guestId ?? '');
  const { memberTierById, familyPaidTierIndex, uiTier, needsFamilyPaidTier } = opts || {};
  const fromMap = memberTierById && id ? memberTierById[id] : undefined;
  if (typeof fromMap === 'number' && fromMap >= 0 && (max === 0 || fromMap < max)) {
    return fromMap;
  }
  if (needsFamilyPaidTier && typeof familyPaidTierIndex === 'number' && familyPaidTierIndex >= 0) {
    if (max === 0 || familyPaidTierIndex < max) return familyPaidTierIndex;
  }
  const u = typeof uiTier === 'number' && uiTier >= 0 ? uiTier : 0;
  return max === 0 || u < max ? u : 0;
}

/** Seed tier when a guest is newly checked: non–year-long preferred when booker UI is year-long + package. */
export function defaultTierForNewGuestSelection(program, uiTier, familyPaidTierIndex, needsFamilyPaidTier) {
  if (needsFamilyPaidTier) {
    if (typeof familyPaidTierIndex === 'number' && familyPaidTierIndex >= 0) return familyPaidTierIndex;
    const ny = nonYearLongTierIndices(program);
    if (ny.length) return ny[0];
  }
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || !tiers.length) return 0;
  const u = typeof uiTier === 'number' && uiTier >= 0 && uiTier < tiers.length ? uiTier : 0;
  return u;
}

const MERGE_SUM_NUMERIC_KEYS = [
  'total',
  'list_subtotal',
  'offer_subtotal',
  'portal_discount_total',
  'self_unit',
  'self_after_promos',
  'annual_household_line_gross',
  'annual_household_after_promos',
  'immediate_family_only_line_gross',
  'immediate_family_only_after_promos',
  'extended_guest_line_gross',
  'extended_guests_after_promos',
  'immediate_family_line_gross',
  'immediate_family_after_promos',
  'family_line_gross',
  'family_after_promos',
  'immediate_family_count',
  'immediate_family_only_count',
  'annual_household_peer_count',
  'extended_guest_count',
  'family_count',
  'tax_included_estimate',
];

const MERGE_SUM_INT_META_KEYS = [
  'annual_household_peer_selected_count',
  'immediate_family_only_selected_count',
  'annual_household_peer_package_included_count',
];

/**
 * Merge several GET /dashboard-quote responses (same program, disjoint guest sets and/or self-only row).
 * Adds `_mergedDashboardQuotes`, `_tierQuoteParts` for UI when more than one tier is involved.
 */
export function mergeDashboardQuoteResponses(program, parts) {
  if (!parts || parts.length === 0) return null;
  if (parts.length === 1) {
    const only = parts[0].data;
    if (!only || typeof only !== 'object') return only;
    return { ...only, _mergedDashboardQuotes: false, _tierQuoteParts: parts };
  }
  const tiers = program?.duration_tiers || [];
  const base = parts[0].data && typeof parts[0].data === 'object' ? { ...parts[0].data } : {};
  const merged = { ...base };
  for (const k of MERGE_SUM_NUMERIC_KEYS) {
    let s = 0;
    for (const p of parts) {
      const v = p.data?.[k];
      s += typeof v === 'number' && !Number.isNaN(v) ? v : Number(v || 0);
    }
    merged[k] = Math.round(s * 100) / 100;
  }
  for (const k of MERGE_SUM_INT_META_KEYS) {
    let s = 0;
    for (const p of parts) {
      const v = p.data?.[k];
      s += typeof v === 'number' && !Number.isNaN(v) ? v : Number(v || 0);
    }
    merged[k] = s;
  }
  merged.include_self = parts.some((p) => p.data?.include_self === true);

  merged._mergedDashboardQuotes = true;
  merged._tierQuoteParts = parts.map((p) => {
    const ti = p.tierIndex;
    const t = tiers[ti];
    const imm = Number(p.data?.immediate_family_only_count || 0);
    const peer = Number(p.data?.annual_household_peer_count || 0);
    const ext = Number(p.data?.extended_guest_count || 0);
    const guestSeats = imm + peer + ext;
    const guestTotal =
      Number(p.data?.immediate_family_only_after_promos || 0) +
      Number(p.data?.annual_household_after_promos || 0) +
      Number(p.data?.extended_guests_after_promos || 0);
    return {
      tierIndex: ti,
      tierLabel: t?.label || `Tier ${ti}`,
      include_self: !!p.data?.include_self,
      total: Number(p.data?.total || 0),
      guestSeats,
      guestTotal,
      data: p.data,
    };
  });
  return merged;
}
