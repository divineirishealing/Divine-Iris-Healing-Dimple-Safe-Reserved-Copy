import {
  resolveEffectiveGuestTierForQuote,
  mergeDashboardQuoteResponses,
  defaultTierForNewGuestSelection,
  programTierIsYearLong,
} from '../dashboardUpcomingHelpers';

const flagship3 = {
  id: 'p1',
  is_flagship: true,
  duration_tiers: [
    { label: '1 Month', duration_unit: 'month' },
    { label: '3 Months', duration_unit: 'month' },
    { label: 'Annual', duration_unit: 'year' },
  ],
};

describe('resolveEffectiveGuestTierForQuote — tier resolution permutations', () => {
  it('prefers explicit memberTierById over family default and UI tier', () => {
    expect(
      resolveEffectiveGuestTierForQuote(flagship3, 'a', {
        memberTierById: { a: 1 },
        familyPaidTierIndex: 0,
        uiTier: 2,
        needsFamilyPaidTier: true,
      }),
    ).toBe(1);
  });

  it('uses familyPaidTierIndex when map missing and needsFamilyPaidTier', () => {
    expect(
      resolveEffectiveGuestTierForQuote(flagship3, 'a', {
        memberTierById: {},
        familyPaidTierIndex: 1,
        uiTier: 2,
        needsFamilyPaidTier: true,
      }),
    ).toBe(1);
  });

  it('falls back to uiTier when needsFamilyPaidTier false and no map', () => {
    expect(
      resolveEffectiveGuestTierForQuote(flagship3, 'a', {
        memberTierById: {},
        familyPaidTierIndex: undefined,
        uiTier: 1,
        needsFamilyPaidTier: false,
      }),
    ).toBe(1);
  });

  it('independent guests can resolve to different tiers (permutation smoke)', () => {
    const map = { deepti: 1, saket: 0 };
    expect(
      resolveEffectiveGuestTierForQuote(flagship3, 'deepti', {
        memberTierById: map,
        uiTier: 0,
        needsFamilyPaidTier: false,
      }),
    ).toBe(1);
    expect(
      resolveEffectiveGuestTierForQuote(flagship3, 'saket', {
        memberTierById: map,
        uiTier: 0,
        needsFamilyPaidTier: false,
      }),
    ).toBe(0);
  });
});

describe('programTierIsYearLong', () => {
  it('detects annual tier index', () => {
    expect(programTierIsYearLong(flagship3, 2)).toBe(true);
    expect(programTierIsYearLong(flagship3, 0)).toBe(false);
  });
});

describe('defaultTierForNewGuestSelection', () => {
  it('uses familyPaidTierIndex when package year-long path', () => {
    expect(defaultTierForNewGuestSelection(flagship3, 2, 1, true)).toBe(1);
  });

  it('uses first non-year-long when family index missing', () => {
    expect(defaultTierForNewGuestSelection(flagship3, 2, undefined, true)).toBe(0);
  });

  it('uses ui tier when not needsFamilyPaidTier', () => {
    expect(defaultTierForNewGuestSelection(flagship3, 1, 0, false)).toBe(1);
  });
});

describe('mergeDashboardQuoteResponses — merged totals', () => {
  const program = flagship3;
  const slice = (total, immA, extA, selfA, includeSelf) => ({
    total,
    list_subtotal: total,
    offer_subtotal: total,
    portal_discount_total: 0,
    self_unit: includeSelf ? selfA : 0,
    self_after_promos: includeSelf ? selfA : 0,
    annual_household_line_gross: 0,
    annual_household_after_promos: 0,
    immediate_family_only_line_gross: immA,
    immediate_family_only_after_promos: immA,
    immediate_family_only_count: immA > 0 ? 1 : 0,
    extended_guest_line_gross: extA,
    extended_guests_after_promos: extA,
    extended_guest_count: extA > 0 ? 1 : 0,
    immediate_family_line_gross: immA,
    immediate_family_after_promos: immA,
    annual_household_peer_count: 0,
    immediate_family_count: immA > 0 ? 1 : 0,
    family_line_gross: immA + extA,
    family_after_promos: immA + extA,
    family_count: (immA > 0 ? 1 : 0) + (extA > 0 ? 1 : 0),
    tax_included_estimate: 0,
    annual_household_peer_selected_count: 0,
    immediate_family_only_selected_count: immA > 0 ? 1 : 0,
    annual_household_peer_package_included_count: 0,
    include_self: includeSelf,
  });

  it('returns single part unchanged shape with _tierQuoteParts', () => {
    const d = slice(13999, 13999, 0, 0, false);
    const m = mergeDashboardQuoteResponses(program, [{ tierIndex: 0, data: d }]);
    expect(m.total).toBe(13999);
    expect(m._mergedDashboardQuotes).toBe(false);
    expect(m._tierQuoteParts).toHaveLength(1);
  });

  it('sums two disjoint guest quotes (1M + 3M style)', () => {
    const p0 = slice(13999, 13999, 0, 0, false);
    const p1 = slice(38999, 38999, 0, 0, false);
    const m = mergeDashboardQuoteResponses(program, [
      { tierIndex: 0, data: p0 },
      { tierIndex: 1, data: p1 },
    ]);
    expect(m._mergedDashboardQuotes).toBe(true);
    expect(m.total).toBe(52998);
    expect(m._tierQuoteParts).toHaveLength(2);
  });

  it('merges self-only row with guest row', () => {
    const selfP = slice(333, 0, 0, 333, true);
    const g = slice(999, 999, 0, 0, false);
    const m = mergeDashboardQuoteResponses(program, [
      { tierIndex: 0, data: selfP },
      { tierIndex: 0, data: g },
    ]);
    expect(m.include_self).toBe(true);
    expect(m.total).toBe(1332);
  });
});
