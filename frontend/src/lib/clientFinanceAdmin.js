import { rowsToBandsPayload } from './indiaDiscountBandsUi';

/**
 * Body fragment for PUT /api/clients/:id — payment rails, India discount/tax/bands, CRM Sacred Home fees.
 * Call {@link validateBandRows} first when the bands editor is shown.
 */
export function buildClientFinancePutPayload({
  preferredPaymentMethod,
  indiaPaymentMethod,
  preferredIndiaGpayId,
  preferredIndiaBankId,
  indiaDiscountPercent,
  indiaDiscountBandRows,
  indiaTaxEnabled,
  indiaTaxPercent,
  indiaTaxLabel,
  crmLateFeePerDay,
  crmChannelizationFee,
  crmShowLateFees,
}) {
  const bandsPayload = rowsToBandsPayload(indiaDiscountBandRows);
  return {
    preferred_payment_method: (preferredPaymentMethod || '').trim().toLowerCase() || '',
    india_payment_method: (indiaPaymentMethod || '').trim() || '',
    preferred_india_gpay_id: (preferredIndiaGpayId || '').trim() || '',
    preferred_india_bank_id: (preferredIndiaBankId || '').trim() || '',
    india_discount_percent:
      indiaDiscountPercent !== '' && indiaDiscountPercent !== null && indiaDiscountPercent !== undefined
        ? parseFloat(String(indiaDiscountPercent).replace(/,/g, '')) || 0
        : null,
    india_tax_enabled: indiaTaxEnabled,
    india_tax_percent: indiaTaxEnabled ? parseFloat(String(indiaTaxPercent)) || 0 : null,
    india_tax_label: (indiaTaxLabel || 'GST').trim() || 'GST',
    india_discount_member_bands: bandsPayload,
    crm_late_fee_per_day: (() => {
      if (crmLateFeePerDay === '' || crmLateFeePerDay == null) return null;
      const n = parseFloat(String(crmLateFeePerDay).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    })(),
    crm_channelization_fee: (() => {
      if (crmChannelizationFee === '' || crmChannelizationFee == null) return null;
      const n = parseFloat(String(crmChannelizationFee).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    })(),
    crm_show_late_fees: crmShowLateFees === '' ? null : crmShowLateFees === 'true',
  };
}
