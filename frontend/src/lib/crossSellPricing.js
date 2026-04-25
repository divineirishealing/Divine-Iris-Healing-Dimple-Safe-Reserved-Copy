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

/** All stable keys for a participant (id + email when both exist) so cart lines with partial data still match. */
export function participantCrossSellIdentityKeys(p) {
  const keys = new Set();
  if (!p || typeof p !== 'object') return keys;
  const mid = String(p.dashboard_family_member_id || p.dashboardFamilyMemberId || '').trim();
  if (mid) keys.add(`m:${mid}`);
  const em = String(p.email || '').trim().toLowerCase();
  if (em) keys.add(`e:${em}`);
  return keys;
}

/** Stable identity across cart lines: family id from Sacred Home, else email (e.g. booker "Myself"). */
export function participantCrossSellIdentity(p) {
  const mid = String(p?.dashboard_family_member_id || p?.dashboardFamilyMemberId || '').trim();
  if (mid) return `m:${mid}`;
  const em = String(p?.email || '').trim().toLowerCase();
  if (em) return `e:${em}`;
  return '';
}

export function addParticipantCrossSellKeysToSet(p, set) {
  if (!set) return;
  for (const k of participantCrossSellIdentityKeys(p)) set.add(k);
}

export function crossSellParticipantKeysOverlap(participant, buyerKeySet) {
  if (!buyerKeySet?.size) return false;
  for (const k of participantCrossSellIdentityKeys(participant)) {
    if (buyerKeySet.has(k)) return true;
  }
  return false;
}

function collectCrossSellRuleMatches(crossSellRules, targetProgramId, cartLineSummaries, strictBuyTier) {
  const out = [];
  if (!crossSellRules?.length || !targetProgramId || !cartLineSummaries?.length) return out;
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
    let buyInCart = false;
    if (strictBuyTier) {
      buyInCart =
        buyTier !== '' && buyTier !== undefined && buyTier !== null
          ? cartLineSummaries.some(
              (i) =>
                String(i.programId) === String(rule.buy_program_id) &&
                String(i.tierIndex) === String(buyTier),
            )
          : cartLineSummaries.some((i) => String(i.programId) === String(rule.buy_program_id));
    } else {
      buyInCart = cartLineSummaries.some((i) => String(i.programId) === String(rule.buy_program_id));
    }
    if (buyInCart) {
      out.push({
        rule,
        matchTarget,
        buyProgramId: String(rule.buy_program_id || '').trim(),
      });
    }
  }
  return out;
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
 * All enabled rules whose target is `targetProgramId` and whose buy-program is in the cart.
 * Uses strict buy-tier matching first; if none match, falls back to buy-program-only so e.g. 1M AWRP
 * still pairs with a rule recorded for another tier (multitier / admin tier drift).
 * @param {Array<{ programId: string, tierIndex: number }>} cartLineSummaries
 * @returns {Array<{ rule: object, matchTarget: object, buyProgramId: string }>}
 */
export function findAllCrossSellRulesForTarget(crossSellRules, targetProgramId, cartLineSummaries) {
  const strict = collectCrossSellRuleMatches(crossSellRules, targetProgramId, cartLineSummaries, true);
  if (strict.length) return strict;
  return collectCrossSellRuleMatches(crossSellRules, targetProgramId, cartLineSummaries, false);
}

/**
 * @param {Array<{ programId: string, tierIndex: number }>} cartLineSummaries
 * @returns {{ rule: object, matchTarget: object, buyProgramId: string } | null}
 */
export function findCrossSellRuleForTarget(crossSellRules, targetProgramId, cartLineSummaries) {
  const all = findAllCrossSellRulesForTarget(crossSellRules, targetProgramId, cartLineSummaries);
  if (!all.length) return null;
  const first = all[0];
  return { rule: first.rule, matchTarget: first.matchTarget, buyProgramId: first.buyProgramId };
}

/**
 * Lowest payable for this seat after considering every matching bundle rule on both portal offer and list.
 * Picks the client-best outcome (does not stack weaker promos on top of a stronger bundle).
 */
export function bestNetPayableForCrossSellSeat(
  lineItem,
  participant,
  cartLineSummaries,
  allProgramLines,
  unitOfferRaw,
  unitListRaw,
  ruleMatches,
) {
  const O = Number(unitOfferRaw) || 0;
  const L = Number(unitListRaw) || 0;
  const baseline = O > 0 ? O : L;
  if (baseline <= 0 || !ruleMatches?.length) return Math.round(baseline * 100) / 100;

  let best = baseline;
  for (const m of ruleMatches) {
    const buyLine = (allProgramLines || []).find(
      (i) => i.type !== 'session' && String(i.programId) === String(m.buyProgramId),
    );
    if (!buyLine?.participants?.length) continue;
    const buyerKeys = new Set();
    for (const bp of buyLine.participants) {
      addParticipantCrossSellKeysToSet(bp, buyerKeys);
    }
    if (!crossSellParticipantKeysOverlap(participant, buyerKeys)) continue;

    const t = m.matchTarget;
    let netRule = baseline;
    if (O > 0 && L > 0) {
      const netO = Math.max(0, O - crossSellDiscountForSeat(t, O));
      const netL = Math.max(0, L - crossSellDiscountForSeat(t, L));
      netRule = Math.min(netO, netL);
    } else if (O > 0) {
      netRule = Math.max(0, O - crossSellDiscountForSeat(t, O));
    } else if (L > 0) {
      netRule = Math.max(0, L - crossSellDiscountForSeat(t, L));
    }
    best = Math.min(best, netRule);
  }
  return Math.round(best * 100) / 100;
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
  for (const bp of buyLine.participants) {
    addParticipantCrossSellKeysToSet(bp, buyerKeys);
  }
  if (!buyerKeys.size) return 0;
  let n = 0;
  for (const p of targetLineItem.participants || []) {
    if (crossSellParticipantKeysOverlap(p, buyerKeys)) n += 1;
  }
  return n;
}

/** One seat: percentage of that seat's payable unit, or fixed amount from rule target. */
export function crossSellDiscountForSeat(matchTarget, unitPrice) {
  if (!matchTarget || unitPrice <= 0) return 0;
  if (matchTarget.discount_type === 'percentage') {
    return Math.round((Number(unitPrice) * (Number(matchTarget.discount_value) || 0)) / 100);
  }
  return Number(matchTarget.discount_value) || 0;
}

/**
 * Sum cross-sell for a cart line: only participants also on the buy line; each seat uses its own unit price
 * (e.g. portal immediate vs extended). Needed when HM is 100% for one guest (Deepti on 3M AWRP) but not another.
 */
/**
 * Discount amount (portal baseline minus best bundle net) for one participant.
 * Baseline is offer when offer &gt; 0, else list. Evaluates every matching rule and offer vs list so e.g. 100% on list beats a weaker portal-only promo.
 */
export function crossSellSeatDiscountAmount(
  crossSellRules,
  lineItem,
  participant,
  cartLineSummaries,
  allProgramLines,
  unitOfferRaw,
  unitListRaw,
) {
  const O = Number(unitOfferRaw) || 0;
  const L = Number(unitListRaw) || 0;
  const baseline = O > 0 ? O : L;
  if (!crossSellRules?.length || baseline <= 0 || !lineItem || !participant) return 0;
  const matches = findAllCrossSellRulesForTarget(crossSellRules, lineItem.programId, cartLineSummaries);
  if (!matches.length) return 0;
  const best = bestNetPayableForCrossSellSeat(
    lineItem,
    participant,
    cartLineSummaries,
    allProgramLines,
    O,
    L,
    matches,
  );
  return Math.round(Math.max(0, baseline - best) * 100) / 100;
}

/**
 * @param {(item: object, p: object) => { offer: number, list: number } | null} getOfferAndListForParticipant
 */
export function sumCrossSellLineDiscount(
  crossSellRules,
  lineItem,
  cartLineSummaries,
  allProgramLines,
  getOfferAndListForParticipant,
) {
  const matches = findAllCrossSellRulesForTarget(crossSellRules, lineItem.programId, cartLineSummaries);
  if (!matches.length) return { total: 0, label: '' };

  let total = 0;
  for (const p of lineItem.participants || []) {
    const pair =
      typeof getOfferAndListForParticipant === 'function' ? getOfferAndListForParticipant(lineItem, p) : null;
    if (!pair) continue;
    const O = Number(pair.offer) || 0;
    const L = Number(pair.list) || 0;
    const baseline = O > 0 ? O : L;
    if (baseline <= 0) continue;

    const best = bestNetPayableForCrossSellSeat(
      lineItem,
      p,
      cartLineSummaries,
      allProgramLines,
      O,
      L,
      matches,
    );
    total += baseline - best;
  }

  return {
    total: Math.round(total * 100) / 100,
    label: matches[0]?.rule?.label || '',
  };
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
  const matches = findAllCrossSellRulesForTarget(crossSellRules, programId, cartSummaries);
  if (!matches.length) return null;
  let bestDisc = 0;
  let best = null;
  for (const m of matches) {
    const disc = crossSellDiscountForSeat(m.matchTarget, effectiveUnitPrice);
    if (disc > bestDisc) {
      bestDisc = disc;
      best = m;
    }
  }
  if (!best) return null;
  const { matchTarget, rule } = best;
  return {
    amount: bestDisc,
    label: rule.label,
    value: matchTarget.discount_value,
    type: matchTarget.discount_type,
  };
}
