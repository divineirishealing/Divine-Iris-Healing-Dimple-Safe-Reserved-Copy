import { buildIndiaGpayOptions, buildIndiaBankOptions, gpayRowMatchesPreference } from './indiaPaymentTags';

export const PREFERRED_LABEL = {
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  cash_deposit: 'Cash deposit',
  stripe: 'Stripe',
  gpay: 'GPay',
  upi: 'UPI',
};

export const TAG_LABEL = {
  gpay: 'GPay',
  upi: 'UPI',
  gpay_upi: 'GPay / UPI',
  bank_transfer: 'Bank transfer',
  bank: 'Bank transfer',
  any: 'Any / Multiple',
  stripe: 'Stripe',
  cash_deposit: 'Cash deposit',
  cash: 'Cash deposit',
};

export function labelFrom(map, raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return '—';
  return map[k] || raw;
}

export function gstSummary(cl) {
  if (!cl.india_tax_enabled) return 'No';
  const pct = cl.india_tax_percent ?? 18;
  const lab = (cl.india_tax_label || 'GST').trim();
  return `${pct}% ${lab}`;
}

export function discountSummary(cl) {
  const bands = cl.india_discount_member_bands;
  const hasBands = Array.isArray(bands) && bands.length > 0;
  const d = cl.india_discount_percent;
  const parts = [];
  if (hasBands) parts.push('by # people');
  if (d !== null && d !== undefined && d !== '') {
    const n = Number(d);
    if (!Number.isNaN(n)) parts.push(`${n}% fallback`);
  } else if (!hasBands) {
    parts.push('0%');
  }
  if (!parts.length) return '—';
  return parts.join(' · ');
}

/** Resolve preferred method + Client Garden tag + pinned rows → labels from Site Settings → Indian Payment. */
export function formatTaggedPaymentDetails(cl, siteInfo) {
  const method = String(cl.india_payment_method || '').trim().toLowerCase();
  const prefPay = String(cl.preferred_payment_method || '').trim().toLowerCase();

  if (method === 'stripe' || prefPay === 'stripe') return 'Stripe';

  const info = siteInfo && typeof siteInfo === 'object' ? siteInfo : {};
  const gpayOpts = buildIndiaGpayOptions(info);
  const bankOpts = buildIndiaBankOptions(info);
  const prefG = (cl.preferred_india_gpay_id || '').trim();
  const prefB = (cl.preferred_india_bank_id || '').trim();

  const parts = [];
  const methodLabel = method && method !== 'any' ? labelFrom(TAG_LABEL, method) : '';
  const prefLabel = prefPay && prefPay !== 'any' ? labelFrom(PREFERRED_LABEL, prefPay) : '';
  if (methodLabel) parts.push(methodLabel);
  else if (prefLabel) parts.push(prefLabel);

  const wantGpay =
    prefPay === 'gpay_upi' ||
    method === 'gpay_upi' ||
    method === 'gpay' ||
    method === 'upi' ||
    method === 'any';
  if (wantGpay && prefG) {
    const row = gpayOpts.find((o) => gpayRowMatchesPreference(o, prefG));
    parts.push(row ? row.label : `UPI ref: ${prefG}`);
  }

  const wantBank =
    prefPay === 'bank_transfer' ||
    prefPay === 'cash_deposit' ||
    method === 'bank_transfer' ||
    method === 'cash_deposit' ||
    method === 'cash' ||
    method === 'any';
  if (wantBank && prefB) {
    const row = bankOpts.find((b) => (b.tag_id || b.bank_code) === prefB);
    parts.push(row ? row.label : `Bank ref: ${prefB}`);
  }

  if (parts.length === 0) {
    return (
      methodLabel ||
      prefLabel ||
      labelFrom(TAG_LABEL, cl.india_payment_method) ||
      labelFrom(PREFERRED_LABEL, cl.preferred_payment_method) ||
      '—'
    );
  }
  return parts.join(' · ');
}
