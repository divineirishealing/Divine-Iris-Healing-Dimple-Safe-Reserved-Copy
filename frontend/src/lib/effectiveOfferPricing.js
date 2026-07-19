/** Early-bird vs regular offer pricing — shared by cards, checkout, and admin previews. */

export function parsePricingDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  if (trimmed.includes('T')) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${trimmed}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isEarlyBirdActive(source) {
  if (!source) return false;
  const end = parsePricingDate(source.early_bird_date);
  if (!end) return false;
  return Date.now() <= end.getTime();
}

export function getEarlyBirdPrice(source, currency) {
  if (!source || !currency) return 0;
  const key = `early_bird_price_${String(currency).toLowerCase()}`;
  return Number(source[key] || 0);
}

export function getRegularOfferPrice(source, currency) {
  if (!source || !currency) return 0;
  const c = String(currency).toLowerCase();
  return Number(source[`offer_price_${c}`] || source[`offer_${c}`] || 0);
}

/** @returns {{ price: number, text: string, isEarlyBird: boolean, deadline: string|null }} */
export function resolveEffectiveOffer(source, currency) {
  if (!source) return { price: 0, text: '', isEarlyBird: false, deadline: null };
  const c = (currency || 'aed').toLowerCase();
  if (isEarlyBirdActive(source)) {
    const eb = getEarlyBirdPrice(source, c);
    if (eb > 0) {
      return {
        price: eb,
        text: (source.early_bird_text || 'Early Bird').trim(),
        isEarlyBird: true,
        deadline: source.early_bird_date || null,
      };
    }
  }
  return {
    price: getRegularOfferPrice(source, c),
    text: (source.offer_text || '').trim(),
    isEarlyBird: false,
    deadline: null,
  };
}

export function pricingSourceForProgram(program, tierIndex = null) {
  const tiers = program?.duration_tiers || [];
  const hasTiers = program?.is_flagship && tiers.length > 0;
  const tier = hasTiers && tierIndex != null ? tiers[tierIndex] : null;
  return tier || program;
}

export function resolveProgramOffer(program, tierIndex, currency) {
  return resolveEffectiveOffer(pricingSourceForProgram(program, tierIndex), currency);
}

export function getEffectiveOfferPrice(program, tierIndex, currency) {
  return resolveProgramOffer(program, tierIndex, currency).price;
}

/** Countdown deadline: early bird date while active, else program deadline/start. */
export function getOfferCountdownDeadline(program, tierIndex = null) {
  const source = pricingSourceForProgram(program, tierIndex);
  const resolved = resolveEffectiveOffer(source, 'aed');
  if (resolved.isEarlyBird && resolved.deadline) return resolved.deadline;
  return program?.deadline_date || program?.start_date || null;
}
