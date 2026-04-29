import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  cn,
  formatDateDdMonYyyy,
  formatDashboardStatDate,
  dashboardEmiTable,
  addMonthsAnnualBundleEnd,
  nextDateWithDayOfMonth,
} from '../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  ArrowRight, ChevronDown, ChevronUp, X, Upload,
  Building2, Smartphone, Wallet, Globe, FileText, Calendar,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { resolveImageUrl, isLikelyImageUrl } from '../../lib/imageUtils';
import {
  gpayRowsForPaymentModal,
  banksForPaymentModal,
  applyPreferredGpayRows,
  applyPreferredBankRows,
  buildIndiaGpayOptions,
  gpayRowMatchesPreference,
} from '../../lib/indiaPaymentTags';

const API = process.env.REACT_APP_BACKEND_URL;

/** Site-wide India bank / UPI; when membership tags are set, only those rows (no full list). */
const IndiaPaymentInfoModal = ({
  info,
  preferredIndiaGpayId = '',
  preferredIndiaBankId = '',
  onClose,
}) => {
  if (!info) return null;
  const prefG = (preferredIndiaGpayId || '').trim();
  const prefB = (preferredIndiaBankId || '').trim();

  const gpayList = Array.isArray(info.india_gpay_accounts) ? info.india_gpay_accounts : [];
  const bankRowsAll = Array.isArray(info.india_bank_accounts) ? info.india_bank_accounts : [];
  const legacy = (info.india_upi_id || '').trim();
  const bd = info.india_bank_details || {};
  const hasLegacyBank = !!(bd && (bd.account_number || '').toString().trim());

  const gpayTaggedOnly = prefG ? buildIndiaGpayOptions(info).filter((o) => gpayRowMatchesPreference(o, prefG)) : null;

  let bankRows = bankRowsAll;
  let showLegacyBank = hasLegacyBank;
  if (prefB) {
    if (bankRowsAll.length > 0) {
      bankRows = bankRowsAll.filter((b, i) => {
        const tagId = b.id || `india-bank-${i}-${String(b.account_number).slice(-4)}`;
        return tagId === prefB;
      });
      showLegacyBank = prefB === 'india-legacy' && bankRows.length === 0 && hasLegacyBank;
    } else {
      bankRows = [];
      showLegacyBank = prefB === 'india-legacy' && hasLegacyBank;
    }
  }

  const hasContent =
    gpayList.length > 0 ||
    !!legacy ||
    bankRowsAll.length > 0 ||
    hasLegacyBank;

  const tagNote =
    prefG || prefB ? (
      <p className="text-[10px] text-amber-900/90 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1.5 mb-3 leading-snug">
        Only the UPI and/or bank account assigned to your membership are shown.
      </p>
    ) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" data-testid="india-payment-info-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-amber-50/80 to-white">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">India — UPI &amp; bank (site)</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Same details as India manual proof — configured under Site Settings. Students use these for GPay and bank transfer.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          {tagNote}
          {!hasContent ? (
            <p className="text-gray-500 text-sm">India payment details are not configured on the site yet. If you use manual transfer, check the payment email or contact support.</p>
          ) : (
            <>
              {prefG ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">UPI / GPay</p>
                  {(gpayTaggedOnly || []).length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No UPI matches your membership tag. Ask admin to align India proof with your subscriber tag.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(gpayTaggedOnly || []).map((o) => (
                        <div key={o.tag_id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                          {o.display_label ? <p className="font-semibold text-gray-800 mb-1">{o.display_label}</p> : null}
                          <p className="font-mono text-emerald-900 select-all">{o.upi_id}</p>
                          {(o.qr_image_url || '').trim() && isLikelyImageUrl(o.qr_image_url) ? (
                            <div className="mt-2 flex justify-center">
                              <img
                                src={resolveImageUrl(o.qr_image_url)}
                                alt=""
                                className="w-36 max-w-full object-contain rounded border border-emerald-200/80 bg-white"
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                (gpayList.length > 0 || legacy) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">UPI / GPay</p>
                    <div className="space-y-2">
                      {legacy ? (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs">
                          <p className="text-[9px] text-gray-500 mb-0.5">Site UPI</p>
                          <p className="font-mono text-emerald-900 select-all">{legacy}</p>
                        </div>
                      ) : null}
                      {gpayList.map((g, i) => (
                        <div key={g.id || i} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                          {g.label ? <p className="font-semibold text-gray-800 mb-1">{g.label}</p> : null}
                          <p className="font-mono text-emerald-900 select-all">{g.upi_id}</p>
                          {(g.qr_image_url || '').trim() && isLikelyImageUrl(g.qr_image_url) ? (
                            <div className="mt-2 flex justify-center">
                              <img
                                src={resolveImageUrl(g.qr_image_url)}
                                alt=""
                                className="w-36 max-w-full object-contain rounded border border-emerald-200/80 bg-white"
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {prefB ? (
                <>
                  {bankRows.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Bank accounts</p>
                      <div className="space-y-2">
                        {bankRows.map((b, i) => (
                          <div key={b.id || i} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 grid grid-cols-1 gap-1">
                            {b.label ? <p className="font-semibold text-gray-800">{b.label}</p> : null}
                            {b.bank_name ? <p><span className="text-blue-400">Bank:</span> <strong className="text-blue-900">{b.bank_name}</strong></p> : null}
                            {b.account_name ? <p><span className="text-blue-400">Name:</span> <strong className="text-blue-900">{b.account_name}</strong></p> : null}
                            {b.account_number ? <p><span className="text-blue-400">A/C:</span> <strong className="font-mono text-blue-900">{b.account_number}</strong></p> : null}
                            {b.ifsc ? <p><span className="text-blue-400">IFSC:</span> <strong className="font-mono text-blue-900">{b.ifsc}</strong></p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {showLegacyBank && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Primary bank (legacy)</p>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-1">
                        {bd.account_name && <p><span className="text-blue-400">Name:</span> <strong>{bd.account_name}</strong></p>}
                        {bd.account_number && <p><span className="text-blue-400">A/C:</span> <strong className="font-mono">{bd.account_number}</strong></p>}
                        {bd.ifsc && <p><span className="text-blue-400">IFSC:</span> <strong className="font-mono">{bd.ifsc}</strong></p>}
                        {bd.bank_name && <p><span className="text-blue-400">Bank:</span> <strong>{bd.bank_name}</strong></p>}
                        {bd.branch && <p><span className="text-blue-400">Branch:</span> {bd.branch}</p>}
                      </div>
                    </div>
                  )}
                  {bankRows.length === 0 && !showLegacyBank && (
                    <p className="text-gray-500 text-sm">
                      No bank account matches your membership tag. Ask admin to align India proof with your subscriber tag.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {bankRowsAll.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Bank accounts</p>
                      <div className="space-y-2">
                        {bankRowsAll.map((b, i) => (
                          <div key={b.id || i} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 grid grid-cols-1 gap-1">
                            {b.label ? <p className="font-semibold text-gray-800">{b.label}</p> : null}
                            {b.bank_name ? <p><span className="text-blue-400">Bank:</span> <strong className="text-blue-900">{b.bank_name}</strong></p> : null}
                            {b.account_name ? <p><span className="text-blue-400">Name:</span> <strong className="text-blue-900">{b.account_name}</strong></p> : null}
                            {b.account_number ? <p><span className="text-blue-400">A/C:</span> <strong className="font-mono text-blue-900">{b.account_number}</strong></p> : null}
                            {b.ifsc ? <p><span className="text-blue-400">IFSC:</span> <strong className="font-mono text-blue-900">{b.ifsc}</strong></p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasLegacyBank && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Primary bank (legacy)</p>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-1">
                        {bd.account_name && <p><span className="text-blue-400">Name:</span> <strong>{bd.account_name}</strong></p>}
                        {bd.account_number && <p><span className="text-blue-400">A/C:</span> <strong className="font-mono">{bd.account_number}</strong></p>}
                        {bd.ifsc && <p><span className="text-blue-400">IFSC:</span> <strong className="font-mono">{bd.ifsc}</strong></p>}
                        {bd.bank_name && <p><span className="text-blue-400">Bank:</span> <strong>{bd.bank_name}</strong></p>}
                        {bd.branch && <p><span className="text-blue-400">Branch:</span> {bd.branch}</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const METHOD_ICONS = {
  neft: Building2, rtgs: Building2, upi: Smartphone, cash: Wallet, gpay: Smartphone
};
const METHOD_LABELS = {
  neft: 'Bank NEFT', rtgs: 'Bank RTGS', upi: 'UPI', cash: 'Cash', gpay: 'GPay'
};

/* ─── PAYMENT MODAL ─── */
const PaymentModal = ({
  emi,
  clientId,
  banks,
  methods,
  indiaReference,
  preferredIndiaGpayId,
  preferredIndiaBankId,
  currency,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState('choose'); // choose | gpay | manual
  const [method, setMethod] = useState('');
  const [txnId, setTxnId] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidBySomeoneElse, setPaidBySomeoneElse] = useState(false);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isVoluntary = !emi?.number || emi.number === 0;
  const [payAmount, setPayAmount] = useState('');
  const [payDifferentAmount, setPayDifferentAmount] = useState(false);

  const gpayListFull = useMemo(() => gpayRowsForPaymentModal(indiaReference), [indiaReference]);
  const gpayList = useMemo(
    () => applyPreferredGpayRows(gpayListFull, preferredIndiaGpayId),
    [gpayListFull, preferredIndiaGpayId]
  );

  const effectiveBanksFull = useMemo(
    () => banksForPaymentModal(indiaReference, banks),
    [indiaReference, banks]
  );
  const effectiveBanks = useMemo(
    () => applyPreferredBankRows(effectiveBanksFull, preferredIndiaBankId),
    [effectiveBanksFull, preferredIndiaBankId]
  );

  const bankCodesKey = useMemo(
    () => (effectiveBanks || []).map((b) => b.bank_code).join('|'),
    [effectiveBanks]
  );

  const [selectedBank, setSelectedBank] = useState(effectiveBanks?.[0]?.bank_code || '');
  const fileRef = useRef(null);

  React.useEffect(() => {
    if (effectiveBanks?.length) setSelectedBank(effectiveBanks[0].bank_code);
  }, [emi?.number, bankCodesKey]);

  React.useEffect(() => {
    setStep('choose');
    setMethod('');
    setTxnId('');
    setNotes('');
    setReceipt(null);
    if (isVoluntary) {
      setPayAmount('');
      setPayDifferentAmount(true);
    } else {
      setPayAmount(emi?.amount != null && emi.amount !== '' ? String(emi.amount) : '');
      setPayDifferentAmount(false);
    }
  }, [emi?.number, isVoluntary, emi?.amount]);

  const hasStripe = methods.includes('stripe');
  const hasExly = methods.includes('exly');
  const hasGpay = methods.includes('gpay') && gpayList.length > 0;
  const hasBankFlow = methods.includes('bank') && effectiveBanks.length > 0;
  const showBankProofCard = methods.includes('manual') || hasBankFlow;

  const handleStripe = () => {
    // Redirect to Stripe checkout for this EMI amount
    toast({ title: 'Redirecting to Stripe...', description: 'Payment gateway will open shortly.' });
    // TODO: Create Stripe session for EMI amount and redirect
  };

  const handleExly = () => {
    toast({ title: 'Redirecting to Exly...', description: 'Payment gateway will open shortly.' });
    // TODO: Redirect to Exly payment link
  };

  const handleManualSubmit = async () => {
    if (!method) { toast({ title: 'Select payment method', variant: 'destructive' }); return; }
    let amt;
    if (!isVoluntary && !payDifferentAmount) {
      amt = Number(emi.amount);
    } else {
      const raw = payAmount.replace(/,/g, '').trim();
      amt = parseFloat(raw);
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('client_id', clientId);
      formData.append('emi_number', isVoluntary ? '0' : String(emi.number));
      formData.append('is_voluntary', isVoluntary ? 'true' : 'false');
      formData.append('payment_method', method);
      formData.append('bank_code', selectedBank);
      formData.append('transaction_id', txnId);
      formData.append('amount', String(amt));
      formData.append('paid_by_name', paidBySomeoneElse ? paidBy : '');
      const noteParts = [notes];
      if (isVoluntary) noteParts.unshift('Flexible payment (student-chosen amount & timing).');
      else if (payDifferentAmount) noteParts.unshift(`Custom amount (scheduled EMI #${emi.number} was ${currency} ${emi.amount}).`);
      formData.append('notes', noteParts.filter(Boolean).join(' '));
      if (receipt) formData.append('receipt', receipt);

      await axios.post(`${API}/api/payment-mgmt/submit`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast({
        title: 'Payment submitted!',
        description: isVoluntary ? 'Awaiting approval — will credit your balance.' : 'Awaiting admin approval.',
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Error submitting payment', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const bank = (effectiveBanks || []).find((b) => b.bank_code === selectedBank);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-testid="payment-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#5D3FD3]/5 to-[#D4AF37]/5">
          <div>
            <h3 className="font-bold text-gray-900">
              {isVoluntary ? 'Flexible payment' : `Pay EMI #${emi.number}`}
            </h3>
            <p className="text-sm text-gray-500">
              {isVoluntary ? (
                <>Choose any amount you wish. After approval it credits your annual balance (not tied to one EMI line).</>
              ) : (
                <>
                  Scheduled {currency} {emi.amount?.toLocaleString()} · due{' '}
                  <span className="tabular-nums">{formatDateDdMonYyyy(emi.due_date) || emi.due_date || 'N/A'}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Step: Choose Method */}
        {step === 'choose' && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4">Choose Payment Method</p>
            {hasStripe && (
              <button onClick={handleStripe} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#5D3FD3] hover:bg-purple-50/50 transition-all group" data-testid="pay-stripe">
                <div className="w-10 h-10 rounded-xl bg-[#635BFF]/10 flex items-center justify-center"><Globe size={18} className="text-[#635BFF]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Pay with Stripe</p>
                  <p className="text-[10px] text-gray-400">International cards, Apple Pay, Google Pay</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#5D3FD3]" />
              </button>
            )}
            {hasExly && (
              <button onClick={handleExly} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#D4AF37] hover:bg-amber-50/50 transition-all group" data-testid="pay-exly">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center"><CreditCard size={18} className="text-[#D4AF37]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Pay with Exly</p>
                  <p className="text-[10px] text-gray-400">India: UPI, Net Banking, Cards</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#D4AF37]" />
              </button>
            )}
            {hasGpay && (
              <button
                onClick={() => setStep('gpay')}
                className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-emerald-500/40 hover:bg-emerald-50/50 transition-all group"
                data-testid="pay-gpay"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Smartphone size={18} className="text-emerald-700" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Google Pay / UPI</p>
                  <p className="text-[10px] text-gray-400">India site UPI (from proof settings) — then submit proof</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-600" />
              </button>
            )}
            {showBankProofCard && (
              <button onClick={() => setStep('manual')} className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-[#84A98C] hover:bg-green-50/50 transition-all group" data-testid="pay-manual">
                <div className="w-10 h-10 rounded-xl bg-[#84A98C]/10 flex items-center justify-center"><Building2 size={18} className="text-[#84A98C]" /></div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-gray-900 text-sm">Bank transfer &amp; proof</p>
                  <p className="text-[10px] text-gray-400">India bank details from site settings, then upload proof</p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#84A98C]" />
              </button>
            )}
          </div>
        )}

        {step === 'gpay' && (
          <div className="p-6 space-y-4">
            <button type="button" onClick={() => setStep('choose')} className="text-xs text-[#5D3FD3] hover:underline mb-2">&larr; Back</button>
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">India site UPI / GPay</p>
            <div className="space-y-3">
              {gpayList.map((g) => (
                <div key={g.tag_id || g.id || g.upi_id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs">
                  {g.label ? <p className="font-semibold text-gray-800 mb-1">{g.label}</p> : null}
                  <p className="font-mono text-emerald-900 select-all">{g.upi_id}</p>
                  {(g.qr_image_url || '').trim() && isLikelyImageUrl(g.qr_image_url) ? (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={resolveImageUrl(g.qr_image_url)}
                        alt=""
                        className="w-40 max-w-full h-auto max-h-44 object-contain rounded-lg border border-emerald-200/80 bg-white"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <Button type="button" onClick={() => setStep('manual')} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white h-10 text-sm">
              I paid — submit proof
            </Button>
          </div>
        )}

        {/* Step: Manual Payment Form */}
        {step === 'manual' && (
          <div className="p-6 space-y-4">
            <button onClick={() => setStep('choose')} className="text-xs text-[#5D3FD3] hover:underline mb-2">&larr; Back to payment options</button>

            {/* Bank Details Display */}
            {effectiveBanks.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-2">Transfer to this account</p>
                {effectiveBanks.length > 1 && (
                  <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm mb-2 bg-white">
                    {effectiveBanks.map(b => <option key={b.bank_code} value={b.bank_code}>{b.bank_name} ({b.bank_code})</option>)}
                  </select>
                )}
                {bank && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-blue-400">Bank:</span> <strong className="text-blue-800">{bank.bank_name}</strong></div>
                    <div><span className="text-blue-400">A/C Name:</span> <strong className="text-blue-800">{bank.account_name}</strong></div>
                    <div><span className="text-blue-400">A/C No:</span> <strong className="text-blue-800 font-mono">{bank.account_number}</strong></div>
                    <div><span className="text-blue-400">IFSC:</span> <strong className="text-blue-800 font-mono">{bank.ifsc_code}</strong></div>
                    {bank.upi_id && <div className="col-span-2"><span className="text-blue-400">UPI:</span> <strong className="text-blue-800">{bank.upi_id}</strong></div>}
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div>
              <Label className="text-xs">Payment Method *</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                {Object.entries(METHOD_LABELS).map(([key, label]) => {
                  const Icon = METHOD_ICONS[key];
                  return (
                    <button key={key} onClick={() => setMethod(key)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] transition-all ${method === key ? 'border-[#5D3FD3] bg-purple-50 text-[#5D3FD3]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      data-testid={`method-${key}`}>
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction Details */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Transaction ID</Label><Input value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="UTR / Ref #" className="h-9" /></div>
              <div>
                <Label className="text-xs">Amount ({currency}) *</Label>
                {isVoluntary ? (
                  <Input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="h-9 font-mono"
                    inputMode="decimal"
                  />
                ) : (
                  <>
                    {!payDifferentAmount ? (
                      <Input value={emi.amount} disabled className="h-9 bg-gray-50 font-mono" />
                    ) : (
                      <Input
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="h-9 font-mono"
                        inputMode="decimal"
                      />
                    )}
                    <label className="flex items-center gap-2 mt-2 text-[10px] text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-3 h-3 accent-[#5D3FD3]"
                        checked={payDifferentAmount}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setPayDifferentAmount(on);
                          setPayAmount(on ? String(emi.amount ?? '') : String(emi.amount ?? ''));
                        }}
                      />
                      Pay a different amount than scheduled
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Paid by someone else */}
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={paidBySomeoneElse} onChange={e => setPaidBySomeoneElse(e.target.checked)} className="w-3.5 h-3.5" />
              Paid by someone else
            </label>
            {paidBySomeoneElse && (
              <div><Label className="text-xs">Payer's Name</Label><Input value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Full name of payer" className="h-9" /></div>
            )}

            {/* Receipt Upload — visible file input (reliable on desktop; hidden + ref.click() is flaky in some browsers) */}
            <div>
              <Label className="text-xs">Upload Receipt / Screenshot</Label>
              <div className="mt-1 space-y-2">
                {receipt ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                    <FileText size={14} className="text-green-600" />
                    <span className="text-xs text-green-700 flex-1 truncate">{receipt.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReceipt(null);
                        const el = fileRef.current;
                        if (el) el.value = '';
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}
                <label className="flex cursor-pointer flex-col gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-3 hover:border-gray-400 transition-colors">
                  <div className="flex items-center gap-2 text-[11px] text-gray-700">
                    <Upload size={16} className="text-[#5D3FD3] shrink-0" />
                    <span>{receipt ? 'Change file' : 'Add receipt (PNG, JPG, PDF)'}</span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full min-h-9 cursor-pointer text-xs text-gray-700 file:mr-3 file:inline-flex file:h-9 file:cursor-pointer file:items-center file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-violet-50"
                    onChange={(e) => {
                      const el = e.target;
                      const f = el.files?.[0] ?? null;
                      if (!f) return;
                      setReceipt(f);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Notes */}
            <div><Label className="text-xs">Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional info..." className="h-9" /></div>

            {/* Submit */}
            <Button onClick={handleManualSubmit} disabled={submitting || !method} className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3] h-11" data-testid="submit-payment">
              {submitting ? <Clock size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
              Submit for Approval
            </Button>
            <p className="text-[9px] text-gray-400 text-center">Your payment will be verified by the admin before confirmation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── FINANCIALS PAGE ─── */
const VOLUNTARY_EMI_PLACEHOLDER = { number: 0, amount: 0, due_date: '', status: 'due' };

const FinancialsPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllEmis, setShowAllEmis] = useState(false);
  const [payingEmi, setPayingEmi] = useState(null);
  const [showIndiaInfo, setShowIndiaInfo] = useState(false);
  const [membershipStart, setMembershipStart] = useState('');
  const [membershipSaving, setMembershipSaving] = useState(false);

  const fetchData = () => {
    axios.get(`${API}/api/student/home`, { withCredentials: true })
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  /* Deep-link from annual package schedule: /dashboard/financials?payEmi=3 */
  useEffect(() => {
    if (loading || !data) return;
    const raw = searchParams.get('payEmi');
    if (raw == null || String(raw).trim() === '') return;
    const num = Number(raw);
    const emisList = data.financials?.emis || [];
    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('payEmi');
      setSearchParams(next, { replace: true });
    };
    if (Number.isNaN(num) || !emisList.length) {
      clearParam();
      return;
    }
    const emi = emisList.find((e) => Number(e?.number) === num);
    if (!emi || emi.status === 'paid' || emi.status === 'submitted') {
      clearParam();
      return;
    }
    const isOverdue = emi.due_date && new Date(emi.due_date) < new Date();
    const daysLate = isOverdue
      ? Math.max(0, Math.floor((Date.now() - new Date(emi.due_date).getTime()) / 86400000))
      : 0;
    const lateFee = daysLate * (data.late_fee_per_day || 0);
    const channelFee = isOverdue && daysLate > 0 ? (data.channelization_fee || 0) : 0;
    setPayingEmi({ ...emi, lateFee, channelFee });
    clearParam();
  }, [loading, data, searchParams, setSearchParams]);

  const pkg = data?.package || {};
  const durationMonths = pkg.duration_months || 12;
  useEffect(() => {
    const s = pkg.start_date;
    setMembershipStart(s ? String(s).slice(0, 10) : '');
  }, [pkg.start_date]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Clock className="animate-spin text-[#5D3FD3]" size={24} />
    </div>
  );

  const fin = data?.financials || {};
  const emis = fin.emis || [];
  const totalPaid = fin.total_paid || 0;
  const remaining = fin.remaining || 0;
  const totalFee = fin.total_fee || 0;
  const paidPct = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;
  const methods = data?.payment_methods || ['stripe', 'manual'];
  const banks = data?.bank_accounts || [];
  const clientId = data?.client_id || '';
  const indiaPaymentReference = data?.india_payment_reference;
  const indiaTaxInfo = data?.india_tax_info;
  const voluntaryCredits = fin.voluntary_credits_total || 0;
  const canManualIndia = (methods || []).some((m) => ['manual', 'gpay', 'bank'].includes(m));
  const showMembershipPeriodCard =
    data?.is_annual_subscriber && (pkg.package_id || '').trim();
  const computedMembershipEnd =
    membershipStart && /^\d{4}-\d{2}-\d{2}$/.test(membershipStart)
      ? addMonthsAnnualBundleEnd(membershipStart, durationMonths)
      : '';
  const anyPaidEmi = emis.some((e) => e && e.status === 'paid');
  const catalogFrom = (pkg.catalog_valid_from || '').trim().slice(0, 10);
  const catalogTo = (pkg.catalog_valid_to || '').trim().slice(0, 10);
  const preferredDom = Math.min(
    28,
    Math.max(
      0,
      typeof pkg.preferred_membership_day_of_month === 'number'
        ? pkg.preferred_membership_day_of_month
        : parseInt(pkg.preferred_membership_day_of_month, 10) || 0,
    ),
  );

  const saveMembershipPeriod = () => {
    if (!membershipStart || !computedMembershipEnd) {
      toast({ title: 'Choose a start date', variant: 'destructive' });
      return;
    }
    setMembershipSaving(true);
    axios
      .put(
        `${API}/api/student/membership-period`,
        { start_date: membershipStart },
        { withCredentials: true },
      )
      .then((res) => {
        toast({ title: 'Membership period saved' });
        if (res.data?.emi_schedule_note) {
          toast({ title: 'Note', description: res.data.emi_schedule_note });
        }
        fetchData();
      })
      .catch((err) => {
        const d = err.response?.data?.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x) => x.msg || x).join(' ')
              : d?.message || err.message || 'Could not save';
        toast({ title: 'Could not save', description: String(msg), variant: 'destructive' });
      })
      .finally(() => setMembershipSaving(false));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="financials-page">
      <h1 className="text-2xl font-bold text-gray-900">Sacred Exchange</h1>
      <p className="text-sm text-gray-500 -mt-4">
        Payments and EMIs. Session dates, times, online/offline, and availed status are on{' '}
        <Link to="/dashboard/sessions" className="text-[#5D3FD3] font-semibold hover:underline">
          Schedule &amp; calendar
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2 items-center -mt-1">
        <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowIndiaInfo(true)} data-testid="open-india-payment-info">
          India: site UPI &amp; bank (reference)
        </Button>
        {remaining > 0 && canManualIndia && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 border-amber-200/80 text-amber-900 bg-amber-50/50 hover:bg-amber-50"
            onClick={() => setPayingEmi({ ...VOLUNTARY_EMI_PLACEHOLDER })}
            data-testid="open-flexible-payment"
          >
            Flexible payment — any amount, anytime
          </Button>
        )}
      </div>
      {voluntaryCredits > 0 && (
        <p className="text-[11px] text-gray-600 -mt-2">
          Approved flexible payments credited to your balance:{' '}
          <strong className="tabular-nums">{fin.currency || 'INR'} {Number(voluntaryCredits).toLocaleString()}</strong>
        </p>
      )}

      {showIndiaInfo && (
        <IndiaPaymentInfoModal
          info={indiaPaymentReference}
          preferredIndiaGpayId={data?.preferred_india_gpay_id || ''}
          preferredIndiaBankId={data?.preferred_india_bank_id || ''}
          onClose={() => setShowIndiaInfo(false)}
        />
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Fee', value: `${fin.currency || ''} ${totalFee.toLocaleString()}`, color: 'text-gray-900', mono: false },
          { label: 'Paid', value: `${fin.currency || ''} ${totalPaid.toLocaleString()}`, color: 'text-green-600', mono: false },
          { label: 'Remaining', value: `${fin.currency || ''} ${remaining.toLocaleString()}`, color: remaining > 0 ? 'text-red-600' : 'text-green-600', mono: false },
          { label: 'Next Due', value: formatDashboardStatDate(fin.next_due), color: 'text-amber-600', mono: false },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 text-center" data-testid={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{s.label}</p>
            <p className={cn('text-lg font-bold mt-1', s.color, s.mono && 'tabular-nums text-base')}>{s.value}</p>
          </div>
        ))}
      </div>

      {fin.crm_discount_percent != null && Number(fin.crm_discount_percent) > 0 ? (
        <p className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 -mt-1">
          Your totals reflect a <strong>{Number(fin.crm_discount_percent).toFixed(1).replace(/\.0$/, '')}%</strong> courtesy adjustment from your host
          {fin.crm_discount_amount != null && Number(fin.crm_discount_amount) > 0 ? (
            <>
              {' '}
              (−{fin.currency || ''} {Number(fin.crm_discount_amount).toLocaleString()} on the listed package fee)
            </>
          ) : null}
          .
        </p>
      ) : null}

      {/* India Tax info badge */}
      {indiaTaxInfo?.enabled && indiaTaxInfo?.visible_on_dashboard && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -mt-2">
          Your fee includes <strong>{indiaTaxInfo.percent}% {indiaTaxInfo.label}</strong> applicable on India payments (GPay / UPI / Bank Transfer).
        </p>
      )}

      {showMembershipPeriodCard && (
        <Card data-testid="membership-period-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar size={16} className="text-[#5D3FD3]" /> Membership period
            </CardTitle>
            <p className="text-[11px] text-gray-500 font-normal leading-snug">
              Choose when your annual membership starts. The end date is set automatically from your package length ({durationMonths} months).
              {(catalogFrom || catalogTo) && (
                <>
                  {' '}
                  Catalog offer window (when this bundle could be purchased)
                  {catalogFrom ? ` from ${formatDateDdMonYyyy(catalogFrom)}` : ''}
                  {catalogTo ? ` to ${formatDateDdMonYyyy(catalogTo)}` : ''}.
                </>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {anyPaidEmi && (
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Membership dates are locked after a payment is recorded. To change them, contact your host.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Membership starts</Label>
                <Input
                  type="date"
                  className="h-9 mt-1 w-[11rem]"
                  value={membershipStart}
                  onChange={(e) => setMembershipStart(e.target.value)}
                  disabled={anyPaidEmi}
                  data-testid="membership-start-input"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Ends (automatic)</Label>
                <p className="h-9 mt-1 flex items-center text-sm font-semibold tabular-nums text-gray-800">
                  {computedMembershipEnd ? formatDateDdMonYyyy(computedMembershipEnd) : '—'}
                </p>
              </div>
              {preferredDom >= 1 && preferredDom <= 28 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs shrink-0 border-violet-200 text-violet-900 bg-violet-50/50 hover:bg-violet-50"
                  disabled={anyPaidEmi}
                  onClick={() => {
                    const ymd = nextDateWithDayOfMonth(null, preferredDom);
                    if (ymd) setMembershipStart(ymd);
                  }}
                  data-testid="membership-anchor-day"
                >
                  Next start on day {preferredDom}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#5D3FD3] hover:bg-[#4c32b3]"
                disabled={anyPaidEmi || membershipSaving || !computedMembershipEnd}
                onClick={saveMembershipPeriod}
                data-testid="membership-period-save"
              >
                {membershipSaving ? <Clock size={14} className="animate-spin" /> : 'Save dates'}
              </Button>
            </div>
            {(pkg.start_date || pkg.end_date) && (
              <p className="text-[10px] text-gray-400">
                On file: {formatDateDdMonYyyy(pkg.start_date) || '—'} → {formatDateDdMonYyyy(pkg.end_date) || '—'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Progress */}
      {totalFee > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Payment Progress</span>
              <span className="text-xs text-gray-400">{paidPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#5D3FD3] to-[#84A98C] transition-all duration-700" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>{fin.payment_mode || 'Direct'}</span>
              <span>{fin.emi_plan}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EMI Schedule with Pay Now */}
      {emis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard size={16} className="text-[#5D3FD3]" /> EMI Schedule
              </CardTitle>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#5D3FD3]/10 text-[#5D3FD3] font-bold">
                {emis.length} Month EMI Plan
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className={dashboardEmiTable.wrap}>
              <table className={dashboardEmiTable.table} data-testid="emi-schedule-table">
                <thead>
                  <tr className={dashboardEmiTable.theadRow}>
                    <th className={dashboardEmiTable.th}>#</th>
                    <th className={dashboardEmiTable.th}>Due date</th>
                    <th className={dashboardEmiTable.thRight}>Amount</th>
                    <th className={dashboardEmiTable.thCenter}>Status</th>
                    {data?.show_late_fees && <th className={cn(dashboardEmiTable.thRight, 'text-red-400')}>Late fee</th>}
                    {data?.show_late_fees && <th className={cn(dashboardEmiTable.thRight, 'text-red-400')}>Ch. fee</th>}
                    <th className={dashboardEmiTable.thCenter}>Payment mode</th>
                    <th className={dashboardEmiTable.th}>Remarks</th>
                    <th className={dashboardEmiTable.thCenter}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllEmis ? emis : emis.slice(0, 4)).map(emi => {
                    const isSubmitted = emi.status === 'submitted';
                    const isPaid = emi.status === 'paid';
                    const isOverdue = !isPaid && !isSubmitted && emi.due_date && new Date(emi.due_date) < new Date();
                    const daysLate = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(emi.due_date).getTime()) / 86400000)) : 0;
                    const lateFee = daysLate * (data?.late_fee_per_day || 0);
                    const channelFee = isOverdue && daysLate > 0 ? (data?.channelization_fee || 0) : 0;
                    const statusLabel = isPaid ? 'paid' : isSubmitted ? 'submitted' : isOverdue ? 'overdue' : 'due';
                    const dueDisp = formatDateDdMonYyyy(emi.due_date) || '—';
                    return (
                      <tr key={emi.number} className={cn(dashboardEmiTable.tbodyTr, isPaid && 'bg-green-50/30', isOverdue && 'bg-red-50/20')} data-testid={`emi-row-${emi.number}`}>
                        <td className={dashboardEmiTable.tdNum}>{emi.number}</td>
                        <td className={dashboardEmiTable.tdDate}>{dueDisp}</td>
                        <td className={dashboardEmiTable.tdAmount}>{fin.currency} {(emi.amount || 0).toLocaleString()}</td>
                        <td className={cn(dashboardEmiTable.td, 'text-center')}>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isPaid ? 'bg-green-50 text-green-700' :
                            isSubmitted ? 'bg-blue-50 text-blue-700' :
                            isOverdue ? 'bg-red-100 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {isPaid && <CheckCircle size={10} />}
                            {isSubmitted && <Clock size={10} />}
                            {isOverdue && <AlertCircle size={10} />}
                            {!isPaid && !isSubmitted && !isOverdue && <Clock size={10} />}
                            {statusLabel}
                          </span>
                        </td>
                        {data?.show_late_fees && (
                          <td className={cn(dashboardEmiTable.tdAmount, 'text-[10px] text-red-600')}>
                            {lateFee > 0 ? `${fin.currency} ${lateFee.toLocaleString()} (${daysLate}d)` : '—'}
                          </td>
                        )}
                        {data?.show_late_fees && (
                          <td className={cn(dashboardEmiTable.tdAmount, 'text-[10px] text-red-600')}>
                            {channelFee > 0 ? `${fin.currency} ${channelFee.toLocaleString()}` : '—'}
                          </td>
                        )}
                        <td className={dashboardEmiTable.tdSmallCenter}>
                          {emi.payment_method ? emi.payment_method.toUpperCase() : '—'}
                        </td>
                        <td className={dashboardEmiTable.tdRemarks}>
                          {emi.paid_by ? `Paid by ${emi.paid_by}` : emi.transaction_id ? `TXN: ${emi.transaction_id}` : emi.remarks || '—'}
                        </td>
                        <td className={cn(dashboardEmiTable.td, 'text-center')}>
                          {isPaid && emi.receipt_url ? (
                            <a href={`${API}${emi.receipt_url}`} target="_blank" rel="noreferrer" className="text-[10px] text-[#5D3FD3] hover:underline flex items-center justify-center gap-1">
                              <FileText size={10} /> Receipt
                            </a>
                          ) : isPaid ? (
                            <span className="text-[10px] text-green-600 flex items-center justify-center gap-1"><CheckCircle size={10} /> Paid</span>
                          ) : isSubmitted ? (
                            <span className="text-[10px] text-blue-500">Awaiting Approval</span>
                          ) : (
                            <Button size="sm" onClick={() => setPayingEmi({...emi, lateFee, channelFee})}
                              className="h-7 text-[10px] bg-[#5D3FD3] hover:bg-[#4c32b3]" data-testid={`pay-now-${emi.number}`}>
                              Pay Now
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {emis.length > 4 && (
              <button onClick={() => setShowAllEmis(!showAllEmis)} className="mt-2 text-xs text-[#5D3FD3] font-medium flex items-center gap-1 hover:underline">
                {showAllEmis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllEmis ? 'Show Less' : `Show All ${emis.length} EMIs`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      {payingEmi && (
        <PaymentModal
          emi={payingEmi}
          clientId={clientId}
          banks={banks}
          methods={methods}
          indiaReference={indiaPaymentReference}
          preferredIndiaGpayId={data?.preferred_india_gpay_id || ''}
          preferredIndiaBankId={data?.preferred_india_bank_id || ''}
          currency={fin.currency || 'INR'}
          onClose={() => setPayingEmi(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default FinancialsPage;
