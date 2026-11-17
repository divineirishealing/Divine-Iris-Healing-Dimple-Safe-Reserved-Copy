import {
  AWRP_INTRO_LANDING_PATH_INDIA,
  AWRP_INTRO_INDIA_PAYMENT_QR_PATH,
  isAwrpIntroProgram,
} from './awrpIntroProgram';
import { pricingSourceForProgram, resolveEffectiveOffer } from './effectiveOfferPricing';

export const MAHALAKSHMI_PROGRAM_ID = '4e564441-9f90-400b-ae44-b192fedf2f15';
export const INDIA_PROGRAM_LANDING_PREFIX = '/india/program';
export const INDIA_PROGRAM_PLINK_SUCCESS_FROM = 'india-program-plink';

/** India ads / Razorpay-only checkout URL for a catalog program. */
export function indiaProgramRazorpayPath(program) {
  if (!program?.id) return null;
  if (isAwrpIntroProgram(program)) return AWRP_INTRO_LANDING_PATH_INDIA;
  if (program.id === MAHALAKSHMI_PROGRAM_ID) {
    return '/india/shri-mahalakshmi-akshaya-samriddhi';
  }
  const custom = String(program.link || '').trim().split('?')[0];
  if (custom.startsWith('/india/') && !custom.startsWith(`${INDIA_PROGRAM_LANDING_PREFIX}/`)) {
    return custom;
  }
  return `${INDIA_PROGRAM_LANDING_PREFIX}/${program.id}`;
}

/** Program detail URLs for homepage India cards — scroll to Razorpay block on generic landings. */
export function indiaProgramRazorpayCheckoutPath(program, { scrollToReserve = true } = {}) {
  const base = indiaProgramRazorpayPath(program);
  if (!base) return null;
  if (
    scrollToReserve
    && base.startsWith(`${INDIA_PROGRAM_LANDING_PREFIX}/`)
  ) {
    return `${base}#india-razorpay-reserve`;
  }
  return base;
}

/** Printable Razorpay payment-link QR (posters / WhatsApp). */
export function indiaProgramPaymentQrPath(program) {
  if (!program?.id) return null;
  if (isAwrpIntroProgram(program)) return AWRP_INTRO_INDIA_PAYMENT_QR_PATH;
  const landing = indiaProgramRazorpayPath(program);
  if (!landing || !landing.startsWith(`${INDIA_PROGRAM_LANDING_PREFIX}/`)) return null;
  return `${INDIA_PROGRAM_LANDING_PREFIX}/${program.id}/payment-qr`;
}

export function programInrListPrice(program, tierIndex = null) {
  if (!program) return 0;
  const tiers = program.duration_tiers || [];
  const hasTier =
    tiers.length > 0 && tierIndex != null && tierIndex >= 0 && tierIndex < tiers.length;
  if (hasTier) {
    return Number(tiers[tierIndex].price_inr || 0);
  }
  return Number(program.price_inr || 0);
}

export function programInrOfferPrice(program, tierIndex = null) {
  if (!program) return 0;
  const source = pricingSourceForProgram(program, tierIndex);
  const { price } = resolveEffectiveOffer(source, 'inr');
  if (price > 0) return price;
  return programInrListPrice(program, tierIndex);
}