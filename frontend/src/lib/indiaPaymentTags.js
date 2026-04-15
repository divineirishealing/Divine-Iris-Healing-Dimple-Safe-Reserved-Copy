/**
 * Stable IDs for tagging a subscriber to one India Proof GPay row or one bank row.
 * Must match filtering in FinancialsPage PaymentModal.
 */

/** @param {object} info — site_settings slice: india_gpay_accounts, india_upi_id */
export function buildIndiaGpayOptions(info) {
  if (!info || typeof info !== 'object') return [];
  const rows = Array.isArray(info.india_gpay_accounts) ? info.india_gpay_accounts : [];
  const out = [];
  const legacy = (info.india_upi_id || '').trim();
  const accountRows = rows.filter((x) => (x.upi_id || '').trim());
  if (legacy && !accountRows.some((r) => (r.upi_id || '').trim() === legacy)) {
    out.push({
      tag_id: 'site-legacy-upi',
      label: `Site UPI (legacy): ${legacy}`,
      display_label: 'Site UPI',
      upi_id: legacy,
      qr_image_url: '',
    });
  }
  accountRows.forEach((g, i) => {
    const upi = (g.upi_id || '').trim();
    const tag_id = g.id || `upi:${upi}` || `gpay-${i}`;
    out.push({
      tag_id,
      label: g.label ? `${g.label} — ${upi}` : upi,
      display_label: g.label || 'UPI',
      upi_id: upi,
      qr_image_url: g.qr_image_url || '',
      id: g.id,
    });
  });
  return out;
}

/** Same rows as buildIndiaGpayOptions but formatted for PaymentModal display cards */
export function gpayRowsForPaymentModal(info) {
  return buildIndiaGpayOptions(info).map((r) => ({
    id: r.tag_id,
    tag_id: r.tag_id,
    label: r.display_label || 'UPI',
    upi_id: r.upi_id,
    qr_image_url: r.qr_image_url,
  }));
}

/**
 * When admin tags a subscriber to one UPI row: only that row (no fallback to listing all).
 * @param {Array<{tag_id?: string, id?: string}>} rows — e.g. from gpayRowsForPaymentModal
 */
export function applyPreferredGpayRows(rows, preferredTagId) {
  const pref = (preferredTagId || '').trim();
  if (!pref || !Array.isArray(rows)) return rows || [];
  return rows.filter((r) => (r.tag_id || r.id) === pref);
}

/**
 * When admin tags a subscriber to one bank row: only that row (no fallback).
 */
export function applyPreferredBankRows(rows, preferredTagId) {
  const pref = (preferredTagId || '').trim();
  if (!pref || !Array.isArray(rows)) return rows || [];
  return rows.filter((r) => (r.tag_id || r.bank_code) === pref);
}

/** Same tag as buildIndiaBankOptions / Subscribers admin dropdown. */
export function indiaBankAccountTagId(b, index) {
  if (!b) return '';
  const num = b.account_number;
  return (b.id || `india-bank-${index}-${String(num != null ? num : '').slice(-4)}`).trim();
}

/** @param {object} info — india_bank_accounts, india_bank_details */
export function buildIndiaBankOptions(info) {
  if (!info || typeof info !== 'object') return [];
  const accounts = Array.isArray(info.india_bank_accounts) ? info.india_bank_accounts : [];
  const out = [];
  accounts
    .filter((b) => (b.account_number || '').toString().trim())
    .forEach((b, i) => {
      const tag_id = b.id || `india-bank-${i}-${String(b.account_number).slice(-4)}`;
      const label = b.label || b.bank_name || `Account ${i + 1}`;
      out.push({
        tag_id,
        label: `${label} · …${String(b.account_number).slice(-4)}`,
        bank_code: tag_id,
        bank_name: b.bank_name || b.label || 'Bank',
        account_name: b.account_name || '',
        account_number: b.account_number || '',
        ifsc_code: b.ifsc || b.ifsc_code || '',
        upi_id: b.upi_id || '',
      });
    });
  const bd = info.india_bank_details || {};
  if (out.length === 0 && (bd.account_number || '').toString().trim()) {
    out.push({
      tag_id: 'india-legacy',
      label: `${bd.bank_name || 'Bank'} (legacy) · …${String(bd.account_number).slice(-4)}`,
      bank_code: 'india-legacy',
      bank_name: bd.bank_name || 'Bank',
      account_name: bd.account_name || '',
      account_number: bd.account_number || '',
      ifsc_code: bd.ifsc || '',
      upi_id: bd.upi_id || '',
    });
  }
  return out;
}

/** Bank rows for PaymentModal (same shape as before) */
export function banksForPaymentModal(info, fallbackBanks) {
  const fromIndia = buildIndiaBankOptions(info);
  if (fromIndia.length > 0) {
    return fromIndia.map((b) => ({
      bank_code: b.bank_code,
      bank_name: b.bank_name,
      account_name: b.account_name,
      account_number: b.account_number,
      ifsc_code: b.ifsc_code,
      upi_id: b.upi_id || '',
      tag_id: b.tag_id,
    }));
  }
  return (fallbackBanks || []).map((b) => ({
    ...b,
    tag_id: b.bank_code,
  }));
}
