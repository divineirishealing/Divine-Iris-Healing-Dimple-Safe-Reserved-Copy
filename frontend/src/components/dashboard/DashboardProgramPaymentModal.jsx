import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  const [enrollment, setEnrollment] = useState(null);
  const [loadingEnroll, setLoadingEnroll] = useState(false);
  const [channel, setChannel] = useState('stripe');
  const [stripeLoading, setStripeLoading] = useState(false);

  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
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
        setPayerEmail(e.booker_email || '');
        if (e.phone) setPayerPhone(String(e.phone).replace(/^\+\d+\s*/, ''));
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

  const submitProof = async () => {
    if (!screenshot || !payerName.trim() || !paymentDate || !transactionId.trim() || !amountInput.trim()) {
      toast({ title: 'Fill all required proof fields', variant: 'destructive' });
      return;
    }
    setSubmittingProof(true);
    try {
      const formData = new FormData();
      formData.append('enrollment_id', enrollmentId);
      formData.append('payer_name', payerName);
      formData.append('payer_email', payerEmail);
      formData.append('payer_phone', payerPhone);
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
      formData.append('screenshot', screenshot);

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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      data-testid="dashboard-program-payment-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
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

        <div className="p-5 space-y-5 text-xs">
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

              {/* Proof upload */}
              {hasOffline && !proofSubmitted && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Upload payment proof</h4>
                  <p className="text-[10px] text-gray-500">
                    After paying by UPI or bank, upload a screenshot and UTR. Admin will approve and you will receive your
                    receipt by email.
                  </p>
                  <div className="grid gap-2">
                    <div>
                      <Label className="text-[10px]">Screenshot *</Label>
                      <p className="text-[10px] text-slate-500 mt-0.5 mb-1">
                        Drag an image into the box, or use the file button below (native &quot;Choose file&quot; — most
                        reliable on phones). Images only.
                      </p>
                      <div
                        className="relative mt-1 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 transition-colors hover:border-[#5D3FD3]/45 hover:bg-violet-50/25"
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
                        <div className="flex flex-col gap-2 p-3">
                          {screenshotPreviewUrl ? (
                            <img
                              src={screenshotPreviewUrl}
                              alt=""
                              className="max-h-36 w-full object-contain rounded-md border border-slate-100 bg-white"
                            />
                          ) : null}
                          <div className="flex flex-col items-center gap-1 text-center">
                            <Upload size={18} className="text-[#5D3FD3]" aria-hidden />
                            <span className="text-[11px] font-medium text-slate-800">
                              {screenshot ? 'Drop to replace, or pick another file' : 'Drop screenshot here'}
                            </span>
                            {screenshot ? (
                              <p className="text-[10px] text-emerald-800 truncate max-w-full">{screenshot.name}</p>
                            ) : null}
                          </div>
                          <input
                            key={open ? `proof-${enrollmentId ?? 'session'}` : 'proof-closed'}
                            ref={proofFileInputRef}
                            type="file"
                            accept="image/*"
                            data-testid="dashboard-proof-screenshot-input"
                            aria-label="Choose payment proof image"
                            className="block w-full min-h-11 cursor-pointer text-xs text-slate-700 file:mr-3 file:inline-flex file:h-10 file:min-h-[44px] file:cursor-pointer file:items-center file:rounded-md file:border file:border-slate-300 file:bg-white file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-900 hover:file:bg-violet-50"
                            onChange={(e) => {
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
                            }}
                          />
                        </div>
                      </div>
                      {screenshot ? (
                        <button
                          type="button"
                          className="mt-1.5 text-[10px] text-slate-500 underline decoration-slate-300 hover:text-slate-800"
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Your name *</Label>
                        <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Payment date *</Label>
                        <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Email</Label>
                      <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Phone</Label>
                      <Input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">UTR / Ref *</Label>
                        <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Amount ({quoteCurrency}) *</Label>
                        <Input value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="h-9 text-xs font-mono" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Paid via</Label>
                      <select
                        value={proofMethod}
                        onChange={(e) => setProofMethod(e.target.value)}
                        className="w-full border rounded-lg h-9 text-xs px-2"
                      >
                        <option value="upi">UPI / GPay</option>
                        <option value="bank_transfer">Bank transfer</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Bank / app (optional)</Label>
                      <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC, GPay" className="h-9 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Notes</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <Button
                      type="button"
                      onClick={submitProof}
                      disabled={submittingProof}
                      className="w-full bg-[#5D3FD3] hover:bg-[#4c32b3] h-10"
                    >
                      {submittingProof ? <Loader2 size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
                      Submit for approval
                    </Button>
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
      </div>
    </div>
  );
}
