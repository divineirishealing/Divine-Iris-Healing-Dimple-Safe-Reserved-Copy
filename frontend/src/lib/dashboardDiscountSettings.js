const DEFAULT_ANNUAL_APPLY = { group: true, combo: true, loyalty: true, cross_sell: true };

function annualApplyFlags(global) {
  const raw = global?.discounts_apply_to_annual_portal || DEFAULT_ANNUAL_APPLY;
  return {
    group: raw.group !== false,
    combo: raw.combo !== false,
    loyalty: raw.loyalty !== false,
    cross_sell: raw.cross_sell !== false,
  };
}

/** Resolve which discount bundle applies on Sacred Home / portal checkout. */
export function resolveActiveDiscountBundle(siteDiscountSettings, annualPortalAccess) {
  const global = siteDiscountSettings || {};
  const annual = global.dashboard_discount_settings || {};
  if (annualPortalAccess && annual.enabled) {
    return { ...global, ...annual, _source: 'annual' };
  }
  const out = { ...global, _source: 'public' };
  if (!annualPortalAccess) return out;
  const flags = annualApplyFlags(global);
  if (!flags.group) out.enable_group_discount = false;
  if (!flags.combo) out.enable_combo_discount = false;
  if (!flags.loyalty) out.enable_loyalty = false;
  if (!flags.cross_sell) out.enable_cross_sell = false;
  return out;
}

export { DEFAULT_ANNUAL_APPLY, annualApplyFlags };