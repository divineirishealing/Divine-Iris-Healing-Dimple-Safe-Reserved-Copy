/** True only when admin enabled pay-as-you-wish on a session/program catalog row. */
export function catalogPayAsYouWishEnabled(item) {
  if (!item || typeof item !== 'object') return false;
  const v = item.pay_as_you_wish;
  return v === true || v === 1 || v === '1' || v === 'true';
}

export function catalogPayAsYouWishMinimumInr(item, fallback = 450) {
  return Math.max(fallback, parseFloat(item?.pay_as_you_wish_minimum_inr) || fallback);
}

export function catalogPayAsYouWishSuggestedInr(item, fallbackMin = 450) {
  let sug = parseFloat(item?.pay_as_you_wish_suggested_inr);
  if (!Number.isFinite(sug) || sug <= 0) {
    sug = parseFloat(item?.offer_price_inr);
  }
  return Number.isFinite(sug) && sug > 0 ? sug : fallbackMin;
}
