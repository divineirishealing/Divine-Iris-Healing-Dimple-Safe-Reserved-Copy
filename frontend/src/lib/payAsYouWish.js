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

/** Convert using site exchange-rate map (`inr_to_aed`, `aed_to_inr`, …). */
export function convertViaExchangeRates(amount, fromCur, toCur, rates) {
  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) return 0;
  const from = String(fromCur || '').toLowerCase();
  const to = String(toCur || '').toLowerCase();
  if (!from || !to || from === to) return amt;
  const direct = parseFloat(rates?.[`${from}_to_${to}`]);
  if (Number.isFinite(direct) && direct > 0) return Math.round(amt * direct * 100) / 100;
  const inverse = parseFloat(rates?.[`${to}_to_${from}`]);
  if (Number.isFinite(inverse) && inverse > 0) return Math.round((amt / inverse) * 100) / 100;
  return 0;
}

/** Minimum contribution in checkout currency (client estimate; server validates INR equivalent). */
export function catalogPayAsYouWishMinimumInCurrency(item, checkoutCurrency, rates, fallbackInr = 450) {
  const minInr = catalogPayAsYouWishMinimumInr(item, fallbackInr);
  const cur = String(checkoutCurrency || 'inr').toLowerCase();
  if (cur === 'inr') return minInr;
  const converted = convertViaExchangeRates(minInr, 'inr', cur, rates);
  return converted > 0 ? converted : minInr;
}
