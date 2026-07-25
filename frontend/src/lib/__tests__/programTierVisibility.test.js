import {
  websiteVisibleTierEntries,
  firstWebsiteVisibleTierIndex,
  isValidWebsiteTierSelection,
  resolveEnrollTierIndex,
  countWebsiteVisibleTiers,
} from '../programTierVisibility';

const awrp = {
  is_flagship: true,
  duration_tiers: [
    { label: '1 Month', visible_on_website: true },
    { label: '2 Months', visible_on_website: true },
    { label: '3 Months', visible_on_website: false },
    { label: '1 Year', visible_on_website: true },
  ],
};

describe('programTierVisibility', () => {
  it('filters hidden tiers for website display', () => {
    expect(countWebsiteVisibleTiers(awrp)).toBe(3);
    expect(websiteVisibleTierEntries(awrp).map((e) => e.catalogIndex)).toEqual([0, 1, 3]);
  });

  it('defaults enroll tier to first visible', () => {
    expect(firstWebsiteVisibleTierIndex(awrp)).toBe(0);
    expect(resolveEnrollTierIndex(awrp, null)).toBe(0);
    expect(resolveEnrollTierIndex(awrp, '')).toBe(0);
  });

  it('allows hidden tier from payment link ?tier=', () => {
    expect(resolveEnrollTierIndex(awrp, '2')).toBe(2);
  });

  it('rejects invalid website selection', () => {
    expect(isValidWebsiteTierSelection(awrp, 2)).toBe(false);
    expect(isValidWebsiteTierSelection(awrp, 1)).toBe(true);
  });
});
