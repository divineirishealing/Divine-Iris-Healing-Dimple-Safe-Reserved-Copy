/**
 * Uniform program hero footer — schedule left, enroll + tiers right.
 */
export function computeProgramHeroLayout({
  program,
  showHeroPrice,
  heroHasSchedule,
  tiersLen,
  heroHasAmount,
  detailEnrollStatus,
}) {
  const heroHasTiers = tiersLen > 0 && program?.show_tiers_on_card !== false;
  const heroEnrollOpen = detailEnrollStatus === 'open';

  const showHeroScheduleCol =
    heroHasSchedule || (showHeroPrice && heroHasAmount && !heroHasTiers);

  const showHeroActionCol =
    heroEnrollOpen || heroHasTiers || detailEnrollStatus !== 'open';

  const showHeroFooterRow = showHeroScheduleCol || showHeroActionCol;
  const showHeroTierPricing = heroHasTiers && showHeroPrice;

  return {
    heroHasTiers,
    heroEnrollOpen,
    showHeroScheduleCol,
    showHeroActionCol,
    showHeroFooterRow,
    showHeroTierPricing,
  };
}
