/**
 * Uniform program hero footer — schedule left, enroll + tiers right.
 * When enrollment is open, detail pages match the AWRP template (enroll + tier rows).
 */
export function computeProgramHeroLayout({
  program,
  showHeroPrice,
  heroHasSchedule,
  tiersLen,
  heroHasAmount,
  detailEnrollStatus,
}) {
  const heroEnrollOpen = detailEnrollStatus === 'open';

  const heroHasTiers =
    tiersLen > 0 && (heroEnrollOpen || program?.show_tiers_on_card !== false);

  const showHeroTierPricing =
    heroHasTiers && (heroEnrollOpen || showHeroPrice);

  const showHeroScheduleCol =
    heroHasSchedule || (showHeroTierPricing && heroHasAmount && !heroHasTiers);

  const showHeroActionCol =
    heroEnrollOpen || heroHasTiers || detailEnrollStatus !== 'open';

  const showHeroFooterRow = showHeroScheduleCol || showHeroActionCol;

  return {
    heroHasTiers,
    heroEnrollOpen,
    showHeroScheduleCol,
    showHeroActionCol,
    showHeroFooterRow,
    showHeroTierPricing,
  };
}

/** Detail-page CTA block — same open-program rules as hero. */
export function computeProgramCtaLayout({ program, showHeroPrice, tiersLen, detailEnrollStatus }) {
  const heroEnrollOpen = detailEnrollStatus === 'open';
  const showCtaTiers =
    tiersLen > 0 && (heroEnrollOpen || program?.show_tiers_on_card !== false);
  const showCtaPricing = heroEnrollOpen || showHeroPrice;
  return { showCtaTiers, showCtaPricing, heroEnrollOpen };
}
