/**
 * Cross-sell bundle discount (same rules as EnrollmentPage / CartPage).
 * When the "buy" program (+ optional tier) is in the cart, the current program line gets the target discount.
 *
 * @param {Array<object>} crossSellRules - from GET /discounts/settings, pre-filtered to enabled rules
 * @param {string} programId - program being priced
 * @param {number|null|undefined} tierIndex - selected duration tier index
 * @param {number} effectiveUnitPrice - offer or list unit price (currency already converted)
 * @param {Array<{ programId: string, tierIndex: number }>} cartItems
 * @returns {{ amount: number, label: string, value: number, type: string } | null}
 */
export function computeCrossSellDiscount(
  crossSellRules,
  programId,
  tierIndex,
  effectiveUnitPrice,
  cartItems,
) {
  if (!crossSellRules?.length || effectiveUnitPrice <= 0) return null;
  for (const rule of crossSellRules) {
    const targets =
      rule.targets ||
      (rule.get_program_id
        ? [
            {
              program_id: rule.get_program_id,
              discount_value: rule.discount_value,
              discount_type: rule.discount_type,
            },
          ]
        : []);
    const matchTarget = targets.find((t) => String(t.program_id) === String(programId));
    if (!matchTarget) continue;
    const buyTier = rule.buy_tier;
    const buyInCart =
      buyTier !== '' && buyTier !== undefined && buyTier !== null
        ? cartItems.some(
            (i) =>
              String(i.programId) === String(rule.buy_program_id) &&
              String(i.tierIndex) === String(buyTier),
          )
        : cartItems.some((i) => String(i.programId) === String(rule.buy_program_id));
    if (buyInCart) {
      const disc =
        matchTarget.discount_type === 'percentage'
          ? Math.round((effectiveUnitPrice * (matchTarget.discount_value || 0)) / 100)
          : matchTarget.discount_value || 0;
      return {
        amount: disc,
        label: rule.label,
        value: matchTarget.discount_value,
        type: matchTarget.discount_type,
      };
    }
  }
  return null;
}
