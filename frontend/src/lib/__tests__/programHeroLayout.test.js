import { computeProgramHeroLayout } from '../programHeroLayout';

describe('computeProgramHeroLayout', () => {
  it('shows enroll action column even without tiers or visible pricing', () => {
    const layout = computeProgramHeroLayout({
      program: { show_tiers_on_card: false },
      showHeroPrice: false,
      heroHasSchedule: true,
      tiersLen: 0,
      heroHasAmount: false,
      detailEnrollStatus: 'open',
    });
    expect(layout.showHeroFooterRow).toBe(true);
    expect(layout.showHeroScheduleCol).toBe(true);
    expect(layout.showHeroActionCol).toBe(true);
    expect(layout.heroEnrollOpen).toBe(true);
    expect(layout.heroHasTiers).toBe(false);
  });

  it('shows tier pricing when tiers exist and pricing is visible', () => {
    const layout = computeProgramHeroLayout({
      program: { show_tiers_on_card: true },
      showHeroPrice: true,
      heroHasSchedule: true,
      tiersLen: 2,
      heroHasAmount: true,
      detailEnrollStatus: 'open',
    });
    expect(layout.heroHasTiers).toBe(true);
    expect(layout.showHeroTierPricing).toBe(true);
  });
});
