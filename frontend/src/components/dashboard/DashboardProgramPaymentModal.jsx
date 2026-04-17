import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import axios from 'axios';
import {
  X,
  Smartphone,
  Building2,
  Upload,
  Loader2,
  CheckCircle,
  CreditCard,
  Globe,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { resolveImageUrl, isLikelyImageUrl } from '../../lib/imageUtils';
import {
  gpayRowsForPaymentModal,
  banksForPaymentModal,
  applyPreferredGpayRows,
  applyPreferredBankRows,
} from '../../lib/indiaPaymentTags';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Annual dashboard: pay for an upcoming program without leaving the page.
 * — Stripe: generate checkout link (copy + open)
 * — GPay / bank: membership-tagged UPI + QR and/or bank, then proof upload for admin approval → receipt email
 */
export default function DashboardProgramPaymentModal({
  open,
  onClose,
  onSuccess,
  enrollmentId,
  programId,
  programTitle,
  tierIndex,
  paymentMethods = [],
  indiaReference,
  preferredIndiaGpayId = '',
  preferredIndiaBankId = '',
  bankAccounts = [],
  currency,
  displayCurrency,
  displayRate,
  isPrimary,
}) {
  const { toast } = useToast();
  const proofFileInputRef = useRef(null);
  const proofFileInputDomId = useId().replace(/:/g, '');

  const [enrollment, setEnrollment] = useState(null);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  const [payerName, setPayerName] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [bankName, setBankName] = useState('');
  const [proofMethod, setProofMethod] = useState('upi');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  const hasStripe = paymentMethods.includes('stripe');
  const hasOffline = paymentMethods.some((x) => ['manual', 'gpay', 'bank'].includes(x));

  const gpayList = useMemo(() => {
    const full = gpayRowsForPaymentModal(indiaReference);
    return applyPreferredGpayRows(full, preferredIndiaGpayId);
  }, [indiaReference, preferredIndiaGpayId]);

  const bankRows = useMemo(() => {
    const full = banksForPaymentModal(indiaReference, bankAccounts);
    return applyPreferredBankRows(full, preferredIndiaBankId);
  }, [indiaReference, bankAccounts, preferredIndiaBankId]);

  const [selectedBankIdx, setSelectedBankIdx] = useState(0);
  const currentBank = bankRows[selectedBankIdx] || {};

  useEffect(() => {
    if (!open) return;
    setProofSubmitted(false);
    setScreenshot(null);
    setScreenshotPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setSelectedBankIdx(0);
    setLoadingEnroll(true);
    axios
      .get(`${API}/api/enrollment/${enrollmentId}`, { withCredentials: true })
      .then((res) => {
        const e = res.data;
        setEnrollment(e);
        setPayerName(e.booker_name || '');
        const amt = e.dashboard_mixed_total;
        if (amt != null && amt !== '') setAmountInput(String(amt));
        const today = new Date().toISOString().slice(0, 10);
        setPaymentDate(today);
      })
      .catch(() => {
        toast({ title: 'Could not load enrollment', variant: 'destructive' });
      })
      .finally(() => setLoadingEnroll(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload enrollment when modal opens / id changes
  }, [open, enrollmentId]);

  const quoteCurrency = (enrollment?.dashboard_mixed_currency || currency || 'INR').toUpperCase();

  const startStripeCheckout = async () => {
    setStripeLoading(true);
    try {
      const checkout = await axios.post(
        `${API}/api/enrollment/${enrollmentId}/checkout`,
        {
          enrollment_id: enrollmentId,
          item_type: 'program',
          item_id: programId,
          currency,
          display_currency: displayCurrency,
          display_rate: isPrimary ? 1 : displayRate,
          origin_url: typeof window !== 'undefined' ? window.location.origin : '',
          promo_code: null,
          tier_index: tierIndex != null ? tierIndex : null,
          points_to_redeem: 0,
          browser_timezone:
            typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
          browser_languages:
            typeof navigator !== 'undefined' && navigator.languages
              ? [...navigator.languages]
              : [typeof navigator !== 'undefined' ? navigator.language : 'en'],
        },
        { withCredentials: true }
      );
      if (checkout.data.url === '__FREE_SUCCESS__') {
        toast({ title: 'No payment required' });
        onSuccess?.();
        const sid = checkout.data.session_id;
        if (sid && typeof window !== 'undefined') {
          window.location.href = `/payment/success?session_id=${encodeURIComponent(sid)}`;
        } else {
          onClose();
        }
        return;
      }
      if (checkout.data.url) {
        window.location.href = checkout.data.url;
        return;
      } else {
        toast({
          title: 'Stripe link unavailable',
          description: checkout.data?.detail || 'Try again or contact support.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Could not start Stripe',
        description: e.response?.data?.detail || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setStripeLoading(false);
    }
  };

  const proofRequiresScreenshot =
    proofMethod === 'bank_transfer' ||
    proofMethod === 'bank_deposit' ||
    proofMethod === 'cash_deposit';

  const proofRequiresNotes = proofMethod === 'cash_deposit';

  const notesFieldHints = useMemo(() => {
    switch (proofMethod) {
      case 'cash_deposit':
        return {
          placeholder:
            'Required: Who deposited (full name), when (date/time), and which bank & branch received the cash.',
        };
      case 'bank_transfer':
      case 'bank_deposit':
        return {
          placeholder: 'Who transferred (name) and which bank? Add any reference details that help us verify.',
        };
      case 'upi':
      default:
        return {
          placeholder: 'Who transferred? (Your name as on GPay / UPI ID or app if known — helps match your payment.)',
        };
    }
  }, [proofMethod]);

  const screenshotBlurb = useMemo(() => {
    if (proofMethod === 'cash_deposit') {
      return 'Required for cash deposit — e.g. stamped deposit slip, counter receipt, or bank acknowledgement.';
    }
    if (proofMethod === 'bank_transfer' || proofMethod === 'bank_deposit') {
      return 'Required for bank transfer — statement screenshot, transfer receipt, or confirmation.';
    }
    return 'Optional — add a screenshot or receipt if you have one.';
  }, [proofMethod]);

  const submitProof = async () => {
    if (!payerName.trim() || !paymentDate || !transactionId.trim() || !amountInput.trim()) {
      toast({ title: 'Fill all required proof fields', variant: 'destructive' });
      return;
    }
    if (proofRequiresScreenshot && !screenshot) {
      toast({
        title: 'Screenshot required',
        description:
          proofMethod === 'cash_deposit'
            ? 'Cash deposit requires a proof image (e.g. deposit slip).'
            : 'Bank deposit / transfer requires a payment proof image.',
        variant: 'destructive',
      });
      return;
    }
    if (proofRequiresNotes && !notes.trim()) {
      toast({
        title: 'Notes required',
        description: 'For cash deposit, please say who deposited, when, and which bank/branch.',
        variant: 'destructive',
      });
      return;
    }
    setSubmittingProof(true);
    try {
      const formData = new FormData();
      formData.append('enrollment_id', enrollmentId);
           formData.append('payer_name', payerName);
      formData.append('payer_email', (enrollment?.booker_email || '').trim());
      formData.append(
        'payer_phone',
        enrollment?.phone ? String(enrollment.phone).replace(/^\+\d+\s*/, '') : ''
      );
      formData.append('payment_date', paymentDate);
      formData.append('bank_name', bankName || currentBank.bank_name || '');
      formData.append('transaction_id', transactionId);
      formData.append('amount', amountInput);
      formData.append('city', '');
      formData.append('state', '');
      formData.append('payment_method', proofMethod);
      formData.append('program_type', 'Flagship Program');
      formData.append('selected_item', programTitle || '');
      formData.append('is_emi', 'false');
      formData.append('notes', notes);
      if (screenshot) formData.append('screenshot', screenshot);

      await axios.post(`${API}/api/india-payments/submit-proof`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProofSubmitted(true);
      toast({
        title: 'Proof submitted',
        description: 'We will verify your payment and email your receipt after approval.',
      });
      onSuccess?.();
    } catch (e) {
      toast({
        title: 'Submit failed',
        description: e.response?.data?.detail || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingProof(false);
    }
  };

  /** Shared by the proof file input (change) and drag-and-drop on the drop zone label. */
  const ingestProofFile = (file) => {
    if (!file) return false;
    if (file.type && !file.type.startsWith('image/')) {
      toast({
        title: 'Please choose an image',
        description: 'Screenshots and photos only for payment proof.',
        variant: 'destructive',
      });
      return false;
    }
    setScreenshot(file);
    setScreenshotPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    return true;
  };

  if (!open) return null;

  const proofFileInputOnChange = (e) => {
    const inputEl = e.target;
    const f = inputEl.files?.[0] ?? null;
    if (!f) return;
    if (!ingestProofFile(f)) {
      inputEl.value = '';
      setScreenshot(null);
      setScreenshotPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-testid="dashboard-program-payment-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl flex w-full max-w-3xl max-h-[96vh] flex-col overflow-hidden sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b bg-gradient-to-r from-[#5D3FD3]/8 to-amber-50/80">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Pay for upcoming program</h3>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{programTitle}</p>
            {enrollment?.dashboard_mixed_total != null && (
              <p className="text-sm font-semibold text-[#b8860b] mt-1 tabular-nums">
                {quoteCurrency} {Number(enrollment.dashboard_mixed_total).toLocaleString()}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 shrink-0" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {loadingEnroll ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#5D3FD3]" size={28} />
            </div>
          ) : (
            <>
              <p className="text-[11px] text-gray-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                Your payment options match what is set on your membership. Use card checkout and/or the UPI or bank details
                below; if you pay offline, upload proof. After admin approval, you will receive your receipt by email (same as
                our standard enrollment flow).
              </p>

              {/* Stripe */}
              {hasStripe && (
                <div className="rounded-xl border border-[#635BFF]/30 bg-[#635BFF]/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[#635BFF]">
                    <Globe size={16} />
                    <span className="font-semibold text-sm text-gray-900">Stripe checkout</span>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    Secure card payment — you will be redirected to Stripe (same as the main enrollment checkout).
                  </p>
                  <Button
                    type="button"
                    onClick={startStripeCheckout}
                    disabled={stripeLoading}
                    className="w-full bg-[#635BFF] hover:bg-[#5048e5] text-white h-10 text-sm"
                  >
                    {stripeLoading ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <CreditCard size={16} className="mr-2" />
                    )}
                    Continue to Stripe
                  </Button>
                </div>
              )}

              {/* Tagged GPay / UPI */}
              {hasOffline && paymentMethods.includes('gpay') && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Smartphone size={16} />
                    <span className="font-semibold text-sm">Your UPI / GPay</span>
                  </div>
                  {gpayList.length === 0 ? (
                    <p className="text-[11px] text-amber-800">No UPI is configured for your membership tag. Contact admin.</p>
                  ) : (
                    gpayList.map((g) => (
                      <div key={g.tag_id || g.id} className="rounded-lg border border-emerald-100 bg-white/90 p-3">
                        <p className="font-semibold text-gray-800 mb-1">{g.label}</p>
                        <p className="font-mono text-emerald-900 select-all text-sm">{g.upi_id}</p>
                        {(g.qr_image_url || '').trim() && isLikelyImageUrl(g.qr_image_url) ? (
                          <div className="mt-2 flex justify-center">
                            <img
                              src={resolveImageUrl(g.qr_image_url)}
                              alt="UPI QR"
                              className="w-40 max-w-full object-contain rounded-lg border border-emerald-100 bg-white"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tagged / site bank (bank or manual channel on membership) */}
              {hasOffline &&
                bankRows.length > 0 &&
                (paymentMethods.includes('bank') || paymentMethods.includes('manual')) && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Building2 size={16} />
                    <span className="font-semibold text-sm">Your bank account</span>
                  </div>
                  {bankRows.length > 1 && (
                    <select
                      value={selectedBankIdx}
                      onChange={(e) => setSelectedBankIdx(Number(e.target.value))}
                      className="w-full border rounded-lg text-xs h-9 px-2"
                    >
                      {bankRows.map((b, i) => (
                        <option key={b.bank_code || i} value={i}>
                          {b.bank_name} · …{String(b.account_number).slice(-4)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="grid gap-1 text-[11px] bg-white/80 rounded-lg p-3 border border-blue-100">
                    {currentBank.account_name && (
                      <p>
                        <span className="text-blue-500">Name:</span> <strong>{currentBank.account_name}</strong>
                      </p>
                    )}
                    {currentBank.account_number && (
                      <p>
                        <span className="text-blue-500">A/C:</span>{' '}
                        <strong className="font-mono">{currentBank.account_number}</strong>
                      </p>
                    )}
                    {currentBank.ifsc_code && (
                      <p>
                        <span className="text-blue-500">IFSC:</span>{' '}
                        <strong className="font-mono">{currentBank.ifsc_code}</strong>
                      </p>
                    )}
                    {currentBank.bank_name && (
                      <p>
                        <span className="text-blue-500">Bank:</span> <strong>{currentBank.bank_name}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {proofSubmitted && (
                <div className="space-y-2">
                  <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-[11px] text-green-900">
                    Proof received. You will get your receipt by email after admin approval.
                  </div>
                  <Button type="button" variant="outline" className="w-full h-9 text-xs" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {!loadingEnroll && hasOffline && !proofSubmitted && (
          <div className="shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-5 sm:p-6 text-xs shadow-[0_-6px_24px_rgba(0,0,0,0.06)]">
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">Upload payment proof</h4>
            <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed max-w-3xl">
              <span className="font-semibold">Bank transfer</span> and <span className="font-semibold">cash deposit</span> need a
              payment screenshot. <span className="font-semibold">Cash deposit</span> also needs notes (who, when, which bank).{' '}
              <span className="font-semibold">UPI / GPay</span> can be submitted without a screenshot; use notes to say who transferred if helpful.
            </p>
            <div className="mt-4 grid gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Your name *</Label>
                  <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} className="h-10 text-xs mt-0.5" />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Email and phone are sent from your enrollment profile — update them in My Profile if needed.
                  </p>
                </div>
                <div>
                  <Label className="text-[10px]">Payment date *</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-10 text-xs mt-0.5" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">UTR / Ref *</Label>
                  <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="h-10 text-xs mt-0.5 font-mono" />
                </div>
                <div>
                  <Label className="text-[10px]">Amount ({quoteCurrency}) *</Label>
                  <Input value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="h-10 text-xs mt-0.5 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px]">Paid via *</Label>
                  <select
                    value={proofMethod}
                    onChange={(e) => setProofMethod(e.target.value)}
                    className="w-full border rounded-lg h-10 text-xs px-2 mt-0.5 bg-white"
                  >
                    <option value="upi">UPI / GPay</option>
                    <option value="bank_transfer">Bank deposit (transfer)</option>
                    <option value="cash_deposit">Cash deposit</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Bank / branch (optional)</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC, branch name" className="h-10 text-xs mt-0.5" />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 sm:p-5">
                <Label className="text-[11px] font-semibold text-slate-800">
                  Payment screenshot {proofRequiresScreenshot ? <span className="text-red-600">*</span> : <span className="text-slate-500 font-normal">(optional)</span>}
                </Label>
                <p className="text-[10px] text-slate-500 mt-1">{screenshotBlurb}</p>
                <input
                  key={open ? `proof-${enrollmentId ?? 'session'}` : 'proof-closed'}
                  id={proofFileInputDomId}
                  ref={proofFileInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="dashboard-proof-screenshot-input"
                  aria-label="Choose payment proof image"
                  className="sr-only"
                  onChange={proofFileInputOnChange}
                />
                <div
                  className="relative mt-3 min-h-[11rem] sm:min-h-[13rem] rounded-xl border border-slate-100 bg-slate-50/80 transition-colors hover:border-[#5D3FD3]/35"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer?.files?.[0] ?? null;
                    ingestProofFile(f);
                  }}
                >
                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    {screenshotPreviewUrl ? (
                      <img
                        src={screenshotPreviewUrl}
                        alt=""
                        className="max-h-52 sm:max-h-64 w-full object-contain rounded-lg border border-slate-100 bg-white shadow-sm"
                      />
                    ) : null}
                    <div className="flex flex-col items-center gap-2 text-center py-2">
                      <Upload size={22} className="text-[#5D3FD3]" aria-hidden />
                      <span className="text-xs font-medium text-slate-800">
                        {screenshot ? 'Drop to replace, or pick another file' : 'Drop screenshot here'}
                      </span>
                      {screenshot ? (
                        <p className="text-[10px] text-emerald-800 truncate max-w-full">{screenshot.name}</p>
                      ) : null}
                    </div>
                    <label
                      htmlFor={proofFileInputDomId}
                      className="flex h-12 w-full cursor-pointer select-none items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xs font-semibold text-slate-900 shadow-sm hover:border-[#5D3FD3]/40 hover:bg-violet-50/80 touch-manipulation"
                    >
                      Choose photo / file
                    </label>
                  </div>
                </div>
                {screenshot ? (
                  <button
                    type="button"
                    className="mt-2 text-[10px] text-slate-500 underline decoration-slate-300 hover:text-slate-800"
                    onClick={() => {
                      setScreenshot(null);
                      setScreenshotPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return '';
                      });
                      const el = proofFileInputRef.current;
                      if (el) el.value = '';
                    }}
                  >
                    Remove attachment
                  </button>
                ) : null}
              </div>

              <div>
                <Label className="text-[10px]">
                  Notes {proofRequiresNotes ? <span className="text-red-600">*</span> : null}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={notesFieldHints.placeholder}
                  className="mt-1 min-h-[72px] text-xs resize-y"
                  rows={3}
                />
              </div>
              <Button
                type="button"
                onClick={submitProof}
                disabled={submittingProof}
                className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3] h-11 text-sm"
              >
                {submittingProof ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
                Submit for approval
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
