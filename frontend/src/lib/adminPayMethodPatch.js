/**
 * Admin-tagged payment rails on a client (preferred + india_payment_method).
 * Shared by Iris Annual Abundance grid and Dashboard Access (non-annual).
 */

/** Value for single admin pay-method control (legacy rows may differ until re-saved). */
export function adminPayMethodSelectValue(cl) {
  if (!cl || typeof cl !== 'object') return '';
  const tag = (cl.india_payment_method || '').trim().toLowerCase();
  if (tag === 'any') return 'any';
  const pref = (cl.preferred_payment_method || '').trim().toLowerCase();
  const ind = (cl.india_payment_method || '').trim().toLowerCase();
  if (pref && ind && pref === ind) return pref;
  if (pref) return pref;
  if (ind) return ind;
  return '';
}

/** Sets both CRM fields so checkout and dashboard see one admin-tagged method. */
export function buildAdminPayMethodPatch(rawVal) {
  const v = (rawVal || '').trim();
  const low = v.toLowerCase();
  if (!v) {
    return {
      preferred_payment_method: '',
      india_payment_method: '',
      preferred_india_gpay_id: '',
      preferred_india_bank_id: '',
    };
  }
  if (low === 'any') {
    return {
      preferred_payment_method: '',
      india_payment_method: 'any',
    };
  }
  const patch = {
    preferred_payment_method: low,
    india_payment_method: low,
  };
  if (low === 'stripe') {
    patch.preferred_india_gpay_id = '';
    patch.preferred_india_bank_id = '';
  } else if (low === 'bank_transfer' || low === 'cash_deposit') {
    patch.preferred_india_gpay_id = '';
  } else if (low === 'gpay_upi') {
    patch.preferred_india_bank_id = '';
  }
  return patch;
}
