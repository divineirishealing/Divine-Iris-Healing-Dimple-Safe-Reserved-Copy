/**
 * Per-tier visibility on the public website (homepage, program page, enroll).
 * Catalog tier indices are unchanged — hidden tiers stay in DB for admin, payment links, dashboard.
 */

export function isTierVisibleOnWebsite(tier) {
  return tier?.visible_on_website !== false;
}

/** @returns {{ tier: object, catalogIndex: number }[]} */
export function websiteVisibleTierEntries(program) {
  return (program?.duration_tiers || [])
    .map((tier, catalogIndex) => ({ tier, catalogIndex }))
    .filter(({ tier }) => isTierVisibleOnWebsite(tier));
}

export function countWebsiteVisibleTiers(program) {
  return websiteVisibleTierEntries(program).length;
}

export function firstWebsiteVisibleTierIndex(program) {
  const entries = websiteVisibleTierEntries(program);
  return entries.length ? entries[0].catalogIndex : 0;
}

export function isValidWebsiteTierSelection(program, catalogIndex) {
  const tiers = program?.duration_tiers || [];
  if (catalogIndex == null || catalogIndex < 0 || catalogIndex >= tiers.length) return false;
  return isTierVisibleOnWebsite(tiers[catalogIndex]);
}

/** Enroll / program page: default to first visible tier; ?tier=N still works for payment links. */
export function resolveEnrollTierIndex(program, tierParam) {
  if (tierParam == null || tierParam === '') {
    return firstWebsiteVisibleTierIndex(program);
  }
  const n = parseInt(tierParam, 10);
  if (Number.isNaN(n) || n < 0) {
    return firstWebsiteVisibleTierIndex(program);
  }
  const tiers = program?.duration_tiers || [];
  if (n >= tiers.length) {
    return firstWebsiteVisibleTierIndex(program);
  }
  return n;
}

export function programHasWebsiteVisibleTiers(program) {
  return Boolean(program?.is_flagship && countWebsiteVisibleTiers(program) > 0);
}
