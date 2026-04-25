/**
 * Tier index sent with checkout/cart API payloads must match cross-sell matching on the server
 * (Mongo rules use string tiers like "0"). Undefined tier must not become "" in cart_tier_set.
 */
export function normalizeCartItemTierIndex(item) {
  if (item?.type === 'session') {
    if (item.tierIndex != null && item.tierIndex !== '') return item.tierIndex;
    return null;
  }
  if (item?.tierIndex != null && item.tierIndex !== '') return item.tierIndex;
  if (item?.isFlagship && (item?.durationTiers || []).length) return 0;
  return 0;
}

/** Stable identity across cart lines: family id from Sacred Home, else email (e.g. booker "Myself"). */
export function participantCrossSellIdentity(p) {
  if (!p || typeof p !== 'object') return '';
  const mid = String(p.dashboard_family_member_id || p.dashboardFamilyMemberId || '').trim();
  if (mid) return `m:${mid}`;
  const em = String(p.email || '').trim().toLowerCase();
  if (em) return `e:${em}`;
  return '';
}

/**
 * Preview participant rows for dashboard cards (before cart sync) — same keys as buildAnnualDashboardCartParticipants.
 */
export function buildDashboardCrossSellPreviewParticipants({
  includedPkg,
  bookerJoinsProgram,
  selectedMemberIds,
  self,
  bookerEmail,
}) {
  const out = [];
  if (!includedPkg && bookerJoinsProgram !== false) {
    const em = String(self?.email || bookerEmail || '').trim().toLowerCase();
    if (em) out.push({ email: em });
  }
  for (const raw of selectedMemberIds || []) {
    const id = String(raw ?? '').trim();
    if (id) out.push({ dashboard_family_member_id: id });
  }
  return out;
}

/**
 * @param {Array<{ programId: string, tierIndex: number }>} cartLineSummaries
 * @returns {{ rule: object, matchTarget: object, buyProgramId: string } | null}
 */
export function findCrossSellRuleForTarget(crossSellRules, targetProgramId, cartLineSummaries) {
  if (!crossSellRules?.length || !targetProgramId || !cartLineSummaries?.length) return null;
  const pidStr = String(targetProgramId);
  for (const rule of crossSellRules) {
    if (rule.enabled === false) continue;
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
    const matchTarget = targets.find((t) => String(t.program_id) === pidStr);
    if (!matchTarget) continue;
    const buyTier = rule.buy_tier;
    const buyInCart =
      buyTier !== '' && buyTier !== undefined && buyTier !== null
        ? cartLineSummaries.some(
            (i) =>
              String(i.programId) === String(rule.buy_program_id) &&
              String(i.tierIndex) === String(buyTier),
          )
        : cartLineSummaries.some((i) => String(i.programId) === String(rule.buy_program_id));
    if (buyInCart) {
      return {
        rule,
        matchTarget,
        buyProgramId: String(rule.buy_program_id || '').trim(),
      };
    }
  }
  return null;
}

/**
 * Seats on `targetLineItem` that also appear on the buy-program line (same person = bundle eligibility).
 * @param {object} targetLineItem - cart row with `programId`, `participants[]`
 * @param {string} buyProgramId
 * @param {Array<object>} allProgramLines - program cart rows (full items from CartContext)
 */
export function crossSellEligibleParticipantCount(targetLineItem, buyProgramId, allProgramLines) {
  const buyPid = String(buyProgramId || '').trim();
  if (!buyPid || !targetLineItem) return 0;
  const buyLine = (allProgramLines || []).find(
    (i) => i.type !== 'session' && String(i.programId) === buyPid,
  );
  if (!buyLine?.participants?.length) return 0;
  const buyerKeys = new Set();
  for (const p of buyLine.participants) {
    const k = participantCrossSellIdentity(p);
    if (k) buyerKeys.add(k);
  }
  if (!buyerKeys.size) return 0;
  let n = 0;
  for (const p of targetLineItem.participants || []) {
    const k = participantCrossSellIdentity(p);
    if (k && buyerKeys.has(k)) n += 1;
  }
  return n;
}

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
  const cartSummaries = cartItems.map((i) => ({
    programId: i.programId,
    tierIndex: i.tierIndex != null && i.tierIndex !== '' ? i.tierIndex : normalizeCartItemTierIndex(i),
  }));
  const match = findCrossSellRuleForTarget(crossSellRules, programId, cartSummaries);
  if (!match) return null;
  const { matchTarget, rule } = match;
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
