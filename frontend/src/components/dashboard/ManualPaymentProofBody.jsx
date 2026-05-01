import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../hooks/use-toast';
import { getAuthHeaders } from '../../lib/authHeaders';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Building2, Upload, FileText, Check,
  Loader2, Calendar, Clock, AlertCircle, ChevronLeft, Smartphone
} from 'lucide-react';
import { resolveImageUrl, isLikelyImageUrl } from '../../lib/imageUtils';
import { buildIndiaGpayOptions, gpayRowMatchesPreference } from '../../lib/indiaPaymentTags';
import {
  computeIndiaManualProofPayableFromTaxableNet,
  parseIndiaSitePercent,
} from '../../lib/indiaClientPricing';
import { formatDateDdMonYyyy } from '../../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PROGRAM_TYPES = ['Personal Session', 'Flagship Program', 'Home Coming Circle'];
const EMI_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Admin CRM: when set, manual proof shows only that rail (GPay vs bank). */
function manualProofPayRail(prefs) {
  const pref = (prefs?.preferred_payment_method || '').trim().toLowerCase();
  const tag = (prefs?.india_payment_method || '').trim().toLowerCase();
  const raw = pref || tag;
  if (!raw || raw === 'any') return null;
  if (raw === 'gpay_upi' || raw === 'gpay' || raw === 'upi') return 'gpay';
  if (raw === 'bank_transfer' || raw === 'cash_deposit') return 'bank';
  return null;
}

/**
 * Full manual India proof form — used on public ManualPaymentPage and embedded in Divine Cart (dashboard).
 * @param {{ enrollmentId?: string, variant?: 'page' | 'embed', onBack?: () => void, onSubmitted?: () => void, embedCartPayableInr?: number|null }} props
 */
export function ManualPaymentProofBody({
  enrollmentId,
  variant = 'page',
  onBack,
  onSubmitted,
  /** Divine Cart embed only: same final INR as cart Total (promo + India stack + points). */
  embedCartPayableInr = null,
}) {
  const { toast } = useToast();
  const isEmbed = variant === 'embed';
  const embedCartPayableRef = useRef(embedCartPayableInr);
  embedCartPayableRef.current = embedCartPayableInr;

  const [settings, setSettings] = useState({});
  const [enrollment, setEnrollment] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedBank, setSelectedBank] = useState(0);
  /** When multiple UPI rows exist, student picks one payee — only that QR / ID is shown. */
  const [selectedGpayIndex, setSelectedGpayIndex] = useState(0);

  // Form fields
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [proofDropActive, setProofDropActive] = useState(false);
  const proofFileRef = useRef(null);
  const [payerName, setPayerName] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  // New dropdown fields
  const [programType, setProgramType] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [isEmi, setIsEmi] = useState(false);
  const [emiMonths, setEmiMonths] = useState('');
  const [emiMonthsCovered, setEmiMonthsCovered] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState([]);
  /** From GET /api/student/home when logged in — matches admin-tagged GPay/bank for annual members. */
  const [studentPrefs, setStudentPrefs] = useState({
    preferred_india_gpay_id: '',
    preferred_india_bank_id: '',
    preferred_payment_method: '',
    india_payment_method: '',
  });
  /** Merged India tax/discount knobs from Sacred Home — for INR payable from enrollment taxable net. */
  const [clientIndiaPricing, setClientIndiaPricing] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, sessionsRes, programsRes, homeRes] = await Promise.all([
          axios.get(`${API}/settings`),
          axios.get(`${API}/sessions?visible_only=true`),
          axios.get(`${API}/programs?visible_only=true`),
          axios
            .get(`${API}/student/home`, {
              withCredentials: true,
              headers: getAuthHeaders(),
            })
            .catch(() => null),
        ]);
        setSettings(settingsRes.data);
        setSessions(sessionsRes.data || []);
        setPrograms(programsRes.data || []);
        if (homeRes?.data) {
          const cip = homeRes.data.client_india_pricing;
          setStudentPrefs({
            preferred_india_gpay_id: (homeRes.data.preferred_india_gpay_id || '').trim(),
            preferred_india_bank_id: (homeRes.data.preferred_india_bank_id || '').trim(),
            preferred_payment_method: (homeRes.data.preferred_payment_method || '').trim(),
            india_payment_method: (cip && typeof cip === 'object' ? cip.india_payment_method : '') || '',
          });
          setClientIndiaPricing(cip && typeof cip === 'object' ? cip : null);
        } else {
          setClientIndiaPricing(null);
        }

        if (enrollmentId) {
          try {
            const enrollRes = await axios.get(`${API}/enrollment/${enrollmentId}`);
            const e = enrollRes.data;
            setEnrollment(e);
            const pg = (e.preferred_india_gpay_id || '').trim();
            const pb = (e.preferred_india_bank_id || '').trim();
            if (pg || pb) {
              setStudentPrefs((prev) => ({
                preferred_india_gpay_id: pg || prev.preferred_india_gpay_id,
                preferred_india_bank_id: pb || prev.preferred_india_bank_id,
                preferred_payment_method: prev.preferred_payment_method,
                india_payment_method: prev.india_payment_method,
              }));
            }
            setPayerName(e.booker_name || '');
            setPayerEmail(e.booker_email || '');
            if (e.phone) setPayerPhone(e.phone.replace(/^\+\d+/, ''));

            const programId = e.item_id || e.participants?.find((p) => p.program_id)?.program_id;
            const itemApiPath = e.item_type === 'session' ? 'sessions' : 'programs';
            const fetchId = e.item_id || programId;
            if (fetchId) {
              try {
                const itemRes = await axios.get(`${API}/${itemApiPath}/${fetchId}`);
                setItemDetails(itemRes.data);
                if (e.item_type === 'session') {
                  setProgramType('Personal Session');
                  setSelectedItem(itemRes.data?.title || '');
                } else {
                  setProgramType('Flagship Program');
                  setSelectedItem(itemRes.data?.title || '');
                }
              } catch {}
            }
            const ep = embedCartPayableRef.current;
            const embedInr =
              isEmbed &&
              ep != null &&
              Number.isFinite(Number(ep)) &&
              Number(ep) > 0;
            if (embedInr) {
              const a = Math.max(0, Math.round(Number(ep) * 100) / 100);
              setAmount(String(a));
            } else if (e.dashboard_mixed_total != null && e.dashboard_mixed_total !== '') {
              const rawTot = Number(e.dashboard_mixed_total);
              const cur = (e.dashboard_mixed_currency || 'inr').toLowerCase();
              const cip = homeRes?.data?.client_india_pricing;
              if (cur === 'inr' && Number.isFinite(rawTot) && rawTot > 0) {
                const adj = computeIndiaManualProofPayableFromTaxableNet(
                  rawTot,
                  cip && typeof cip === 'object' ? cip : null,
                  settingsRes.data,
                );
                setAmount(String(adj ? adj.roundedTotal : rawTot));
              } else {
                setAmount(String(rawTot));
              }
            }
          } catch {}
        }
      } catch {
        toast({ title: 'Could not load settings', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [enrollmentId]);

  useEffect(() => {
    if (!isEmbed || embedCartPayableInr == null) return;
    const n = Number(embedCartPayableInr);
    if (!Number.isFinite(n) || n <= 0) return;
    setAmount(String(Math.max(0, Math.round(n * 100) / 100)));
  }, [isEmbed, embedCartPayableInr]);

  /** All India GPay / UPI rows from site settings (full list). */
  const gpayOptionsAll = useMemo(() => {
    const opts = buildIndiaGpayOptions({
      india_gpay_accounts: settings.india_gpay_accounts,
      india_upi_id: settings.india_upi_id,
    });
    return opts.map((o) => ({
      id: o.tag_id,
      label: o.display_label || o.label,
      upi_id: o.upi_id,
      qr_image_url: o.qr_image_url || '',
    }));
  }, [settings.india_gpay_accounts, settings.india_upi_id]);

  /** When admin tags this member to one UPI row, only that payee + QR (same idea as filtered bank list). */
  const gpayOptionsForForm = useMemo(() => {
    const pref = (studentPrefs.preferred_india_gpay_id || '').trim();
    if (!pref) return gpayOptionsAll;
    return gpayOptionsAll.filter((g) => gpayRowMatchesPreference(g, pref));
  }, [gpayOptionsAll, studentPrefs.preferred_india_gpay_id]);

  useEffect(() => {
    if (gpayOptionsForForm.length === 0) return;
    const pref = (studentPrefs.preferred_india_gpay_id || '').trim();
    if (pref) {
      setSelectedGpayIndex(0);
      return;
    }
    setSelectedGpayIndex((i) => Math.min(Math.max(0, i), gpayOptionsForForm.length - 1));
  }, [gpayOptionsForForm, studentPrefs.preferred_india_gpay_id]);

  const selectedGpay =
    gpayOptionsForForm.length > 0
      ? gpayOptionsForForm[Math.min(Math.max(0, selectedGpayIndex), gpayOptionsForForm.length - 1)]
      : null;

  const banks = useMemo(() => {
    const bankAccounts = settings.india_bank_accounts || [];
    const singleBank = settings.india_bank_details || {};
    let list = bankAccounts.length > 0 ? bankAccounts : singleBank.account_number ? [singleBank] : [];
    const pref = (studentPrefs.preferred_india_bank_id || '').trim();
    if (!pref) return list;
    if (bankAccounts.length > 0) {
      return bankAccounts.filter((b, i) => {
        const tagId = b.id || `india-bank-${i}-${String(b.account_number).slice(-4)}`;
        return tagId === pref;
      });
    }
    if (pref === 'india-legacy' && singleBank.account_number) return [singleBank];
    return [];
  }, [
    settings.india_bank_accounts,
    settings.india_bank_details,
    studentPrefs.preferred_india_bank_id,
  ]);

  useEffect(() => {
    setSelectedBank(0);
  }, [enrollmentId, banks]);

  /** Default payment date to today when submitting against a specific enrollment (cart or manual page with id). */
  useEffect(() => {
    if (!enrollmentId) return;
    setPaymentDate(new Date().toISOString().slice(0, 10));
  }, [enrollmentId]);

  const payRail = useMemo(
    () =>
      manualProofPayRail({
        preferred_payment_method: studentPrefs.preferred_payment_method,
        india_payment_method: studentPrefs.india_payment_method,
      }),
    [studentPrefs.preferred_payment_method, studentPrefs.india_payment_method],
  );

  /** Prefer UPI vs bank from admin-tagged pay method when set; else infer from available rails. */
  useEffect(() => {
    if (loading) return;
    if (payRail === 'gpay') {
      if (gpayOptionsForForm.length > 0) setPaymentMethod('upi');
      return;
    }
    if (payRail === 'bank') {
      setPaymentMethod('bank_transfer');
      return;
    }
    if (gpayOptionsForForm.length > 0 && banks.length === 0) setPaymentMethod('upi');
    else if (gpayOptionsForForm.length === 0 && banks.length > 0) setPaymentMethod('bank_transfer');
  }, [loading, payRail, gpayOptionsForForm.length, banks.length]);

  const currentBank = banks[selectedBank] || {};
  const hasBank = banks.length > 0;
  const showGpaySection = payRail !== 'bank' && gpayOptionsForForm.length > 0 && selectedGpay;
  const showBankSection = payRail !== 'gpay' && hasBank;
  const programTitle = enrollment?.item_title || itemDetails?.title || '';
  const quoteCurrency = (enrollment?.dashboard_mixed_currency || 'inr').toUpperCase();
  /** Enrollment stores taxable net for INR; cart Total adds GST/platform — match that for proof amount. */
  const enrollmentCartTotalDisplay = useMemo(() => {
    const embed =
      isEmbed &&
      embedCartPayableInr != null &&
      Number.isFinite(Number(embedCartPayableInr)) &&
      Number(embedCartPayableInr) > 0 &&
      quoteCurrency.toLowerCase() === 'inr';
    if (embed) {
      const amt = Math.max(0, Math.round(Number(embedCartPayableInr) * 100) / 100);
      const gstPct = parseIndiaSitePercent(settings, 'india_gst_percent', 18);
      return {
        amount: amt,
        subnote:
          gstPct > 0
            ? 'Includes GST and any platform fee — same as your cart total above.'
            : 'Same as your cart total above.',
      };
    }
    if (enrollment?.dashboard_mixed_total == null || enrollment?.dashboard_mixed_total === '') return null;
    const raw = Number(enrollment.dashboard_mixed_total);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const cur = (enrollment.dashboard_mixed_currency || 'inr').toLowerCase();
    if (cur !== 'inr') {
      return { amount: raw, subnote: null };
    }
    const adj = computeIndiaManualProofPayableFromTaxableNet(raw, clientIndiaPricing, settings);
    if (!adj) return { amount: raw, subnote: null };
    return {
      amount: adj.roundedTotal,
      subnote:
        adj.gstPct > 0
          ? `Includes ${adj.taxLabel} and any platform fee — same as your cart total above.`
          : 'Same as your cart total above.',
    };
  }, [isEmbed, embedCartPayableInr, quoteCurrency, enrollment, clientIndiaPricing, settings]);
  const isUpiMethod = paymentMethod === 'upi';
  const screenshotRequired =
    paymentMethod === 'cheque' || paymentMethod === 'cash_deposit';
  const notesRequired =
    isUpiMethod || paymentMethod === 'cheque' || paymentMethod === 'cash_deposit';
  const notesLabel = notesRequired ? 'Payment details *' : 'Additional notes';
  const notesPlaceholder = isUpiMethod
    ? 'Who paid (name as on UPI / GPay)? When did you pay (date and approximate time)?'
    : paymentMethod === 'cheque' || paymentMethod === 'cash_deposit'
      ? 'Who deposited or gave the cheque? Which city? Which bank / branch?'
      : 'Any extra detail (optional).';

  const acceptProofFile = useCallback(
    (file, inputEl) => {
      if (!file) return;
      if (file.type && !file.type.startsWith('image/')) {
        toast({ title: 'Please use an image file', variant: 'destructive' });
        if (inputEl) inputEl.value = '';
        return;
      }
      setScreenshotPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setScreenshot(file);
      try {
        const el = proofFileRef.current;
        if (el) {
          const dt = new DataTransfer();
          dt.items.add(file);
          el.files = dt.files;
        }
      } catch {
        // Some browsers disallow assigning input.files
      }
    },
    [toast],
  );

  const handleScreenshot = (e) => {
    acceptProofFile(e.target.files?.[0] ?? null, e.target);
  };

  const handleProofDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setProofDropActive(false);
    const file = e.dataTransfer?.files?.[0] ?? null;
    acceptProofFile(file, null);
  };

  const handleProofDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const clearScreenshot = () => {
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setScreenshot(null);
    const el = proofFileRef.current;
    if (el) el.value = '';
  };

  const handleSubmit = async () => {
    if (!payerName || !paymentDate || !transactionId || !amount) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (screenshotRequired && !screenshot) {
      toast({
        title: 'Screenshot required',
        description: 'Attach an image for cheque or cash deposit.',
        variant: 'destructive',
      });
      return;
    }
    if (notesRequired && !(notes || '').trim()) {
      toast({
        title: 'Payment details required',
        description: isUpiMethod
          ? 'Add who paid and when in the details box.'
          : 'Add who paid, city, and bank in the details box.',
        variant: 'destructive',
      });
      return;
    }
    if (!isEmbed && !programType) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (!isUpiMethod && !(bankName || '').trim() && !hasBank) {
      toast({ title: 'Enter bank / app name or pick a bank account above', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const effProgramType =
        programType ||
        (enrollment?.item_type === 'session' ? 'Personal Session' : 'Flagship Program');
      const effSelectedItem = (selectedItem || programTitle || '').trim();
      const gpayTagLine =
        isUpiMethod && selectedGpay
          ? `UPI / GPay — ${(selectedGpay.label || 'Payee').trim()} (${String(selectedGpay.upi_id || '').trim()})`
          : '';
      const bankField =
        (bankName || '').trim() ||
        gpayTagLine ||
        (isUpiMethod ? 'UPI / GPay' : '') ||
        (currentBank.label || currentBank.bank_name || '');
      const formData = new FormData();
      if (screenshot) formData.append('screenshot', screenshot);
      formData.append('enrollment_id', enrollmentId || 'MANUAL');
      formData.append('payer_name', payerName);
      formData.append('payer_email', payerEmail);
      formData.append('payer_phone', `${phoneCode}${payerPhone}`);
      formData.append('payment_date', paymentDate);
      formData.append('bank_name', bankField);
      formData.append('transaction_id', transactionId);
      formData.append('amount', amount);
      formData.append('city', '');
      formData.append('state', '');
      formData.append('payment_method', paymentMethod);
      formData.append('program_type', effProgramType);
      formData.append('selected_item', effSelectedItem);
      formData.append('is_emi', isEmi ? 'true' : 'false');
      if (isEmi) {
        formData.append('emi_total_months', emiMonths);
        formData.append('emi_months_covered', emiMonthsCovered);
      }
      formData.append('notes', notes);
      await axios.post(`${API}/india-payments/submit-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubmitted(true);
      toast({ title: 'Payment proof submitted successfully!' });
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Submission failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className={
          isEmbed
            ? 'flex items-center justify-center py-16'
            : 'min-h-screen flex items-center justify-center pt-24'
        }
      >
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={isEmbed ? 'py-6 px-2' : 'min-h-screen flex items-center justify-center pt-24 pb-16 px-4'}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proof Submitted</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your payment proof has been submitted for verification. You&apos;ll receive a confirmation once approved.
          </p>
          <Button
            onClick={() => (onSubmitted ? onSubmitted() : undefined)}
            className="bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full px-8"
          >
            {isEmbed ? 'Back to dashboard' : 'Back to Home'}
          </Button>
        </div>
      </div>
    );
  }

  const shellClass = isEmbed
    ? 'bg-white/95 backdrop-blur rounded-xl border border-[rgba(212,175,55,0.35)] shadow-lg p-4 sm:p-5'
    : 'min-h-screen bg-gray-50 pt-28 pb-16 px-4';

  return (
    <div className={shellClass} data-testid={isEmbed ? 'manual-payment-embed' : 'manual-payment-page'}>
      <div className={isEmbed ? '' : 'max-w-4xl mx-auto'}>
          <button
            type="button"
            onClick={() => (onBack ? onBack() : undefined)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
            data-testid="manual-back-btn"
          >
            <ChevronLeft size={16} /> {isEmbed ? 'Back to checkout' : 'Back to payment options'}
          </button>
          <div className={isEmbed ? 'grid grid-cols-1 gap-6' : 'grid lg:grid-cols-5 gap-6'}>

            {/* Left: Form */}
            <div className={isEmbed ? 'space-y-4' : 'lg:col-span-3 space-y-4'}>
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h1 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Building2 size={20} className="text-[#D4AF37]" />
                  Submit Manual Payment
                </h1>
                <p className="text-xs text-gray-500 mb-5">Upload your payment proof for admin approval.</p>
                {enrollmentCartTotalDisplay && (
                  <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2 text-[11px] text-violet-950">
                    <span className="font-semibold">Pay this amount (final total): </span>
                    <span className="font-bold tabular-nums">
                      {quoteCurrency} {Number(enrollmentCartTotalDisplay.amount).toLocaleString()}
                    </span>
                    {enrollmentCartTotalDisplay.subnote ? (
                      <p className="mt-1 text-[10px] text-violet-900/85 leading-snug">
                        {enrollmentCartTotalDisplay.subnote}
                      </p>
                    ) : null}
                  </div>
                )}

                {payRail === 'gpay' && gpayOptionsForForm.length === 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
                    Your pay method is set to <strong>GPay / UPI</strong>, but no UPI is available for you here. Ask your
                    admin to configure India payments or align your account tag.
                  </div>
                )}
                {payRail === 'bank' && !hasBank && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
                    Your pay method is set to <strong>bank transfer</strong>, but no bank account is available for you
                    here. Ask your admin to configure India payments or align your account tag.
                  </div>
                )}

                {studentPrefs.preferred_india_gpay_id && gpayOptionsForForm.length === 0 && payRail !== 'bank' && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
                    Your membership is set to a specific UPI, but it does not match any row in India proof. Ask your admin to fix the tag or site settings.
                  </div>
                )}

                {showGpaySection && (
                  <div className="border rounded-xl p-5 mb-5 border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Smartphone size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        {studentPrefs.preferred_india_gpay_id
                          ? 'Your assigned UPI / GPay'
                          : 'Divine Iris — Google Pay / UPI'}
                      </h3>
                    </div>
                    {gpayOptionsForForm.length > 1 ? (
                      <div className="mb-4">
                        <p className="text-[10px] font-semibold text-gray-700 mb-2">
                          Tag the account you paid to (only that QR is shown) *
                        </p>
                        <div className="space-y-2">
                          {gpayOptionsForForm.map((g, i) => (
                            <label
                              key={g.id || g.upi_id || i}
                              className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer text-xs ${
                                selectedGpayIndex === i
                                  ? 'border-emerald-400 bg-white shadow-sm'
                                  : 'border-emerald-100 bg-white/60'
                              }`}
                            >
                              <input
                                type="radio"
                                name="manual-proof-gpay-tag"
                                className="mt-0.5 shrink-0"
                                checked={selectedGpayIndex === i}
                                onChange={() => setSelectedGpayIndex(i)}
                              />
                              <span className="min-w-0">
                                <span className="font-semibold text-gray-800 block">{g.label || 'UPI'}</span>
                                <span className="font-mono text-emerald-900 select-all text-[11px]">{g.upi_id}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3">
                          Use the QR and UPI ID below for your tagged payee. Screenshot is optional; add who paid and when in
                          the notes field.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-600 mb-3">
                        Pay using the UPI ID below. Screenshot is optional; add payment details in the notes field.
                      </p>
                    )}
                    <div className="rounded-lg border border-emerald-100 bg-white/80 p-3 text-xs">
                      {selectedGpay.label ? <p className="font-semibold text-gray-800 mb-1">{selectedGpay.label}</p> : null}
                      <p className="font-mono text-emerald-900 select-all">{selectedGpay.upi_id}</p>
                      {(selectedGpay.qr_image_url || '').trim() && isLikelyImageUrl(selectedGpay.qr_image_url) ? (
                        <div className="mt-3 flex justify-center">
                          <img
                            src={resolveImageUrl(selectedGpay.qr_image_url)}
                            alt={selectedGpay.label ? `QR ${selectedGpay.label}` : 'UPI QR code'}
                            className="w-44 max-w-full h-auto max-h-48 object-contain border border-emerald-100 rounded-lg bg-white"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {studentPrefs.preferred_india_bank_id && !hasBank && payRail !== 'gpay' && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
                    Your membership is set to a specific bank account, but it does not match India proof. Ask your admin to fix the tag or site settings.
                  </div>
                )}

                {/* Bank Details */}
                {showBankSection && (
                  <div className="border rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={16} className="text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        {studentPrefs.preferred_india_bank_id ? 'Your assigned bank account' : 'Divine Iris Bank Details'}
                      </h3>
                    </div>

                    {banks.length > 1 ? (
                      <div className="mb-3">
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">
                          Which account did you send money to? *
                        </label>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(parseInt(e.target.value, 10))}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-bank-select"
                        >
                          {banks.map((b, i) => (
                            <option key={i} value={i}>
                              {b.label || b.bank_name || b.account_name || `Account ${i + 1}`}{' '}
                              {b.bank_name ? `(${b.bank_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                      {currentBank.account_name && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Account Name</span>
                          <span className="font-semibold text-gray-900 select-all">{currentBank.account_name}</span>
                        </div>
                      )}
                      {currentBank.account_number && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Account Number</span>
                          <span className="font-mono font-semibold text-gray-900 select-all">{currentBank.account_number}</span>
                        </div>
                      )}
                      {(currentBank.ifsc || currentBank.ifsc_code) && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">IFSC Code</span>
                          <span className="font-mono font-semibold text-gray-900 select-all">
                            {currentBank.ifsc || currentBank.ifsc_code}
                          </span>
                        </div>
                      )}
                      {currentBank.bank_name && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Bank</span>
                          <span className="font-semibold text-gray-900">{currentBank.bank_name}</span>
                        </div>
                      )}
                      {currentBank.branch && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Branch</span>
                          <span className="font-semibold text-gray-900">{currentBank.branch}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isEmbed && (
                <>
                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Email *</label>
                    <Input type="email" value={payerEmail} onChange={e => setPayerEmail(e.target.value)}
                      placeholder="your@email.com" className="text-xs h-9" autoComplete="email" data-testid="manual-email" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Phone *</label>
                    <div className="flex gap-1">
                      <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                        className="border rounded-lg text-xs h-9 px-1.5 w-20 text-gray-700" data-testid="manual-phone-code">
                        <option value="+91">+91</option>
                        <option value="+971">+971</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                        <option value="+966">+966</option>
                        <option value="+974">+974</option>
                        <option value="+965">+965</option>
                        <option value="+968">+968</option>
                        <option value="+973">+973</option>
                        <option value="+61">+61</option>
                        <option value="+65">+65</option>
                      </select>
                      <Input type="tel" value={payerPhone} onChange={e => setPayerPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="Phone number" className="text-xs h-9 flex-1" autoComplete="tel-national" data-testid="manual-phone" />
                    </div>
                  </div>
                </div>

                {/* Program Type & Item Selection */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Program Type *</label>
                      <select value={programType} onChange={e => { setProgramType(e.target.value); setSelectedItem(''); }}
                        className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                        data-testid="manual-program-type">
                        <option value="">Select type</option>
                        {PROGRAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {programType === 'Personal Session' && sessions.length > 0 && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Select Session *</label>
                        <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-select-session">
                          <option value="">Choose a session</option>
                          {sessions.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                        </select>
                      </div>
                    )}
                    {programType === 'Flagship Program' && programs.length > 0 && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Select Program *</label>
                        <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-select-program">
                          <option value="">Choose a program</option>
                          {programs.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                        </select>
                      </div>
                    )}
                    {programType === 'Home Coming Circle' && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Is this EMI payment?</label>
                        <select value={isEmi ? 'yes' : 'no'} onChange={e => setIsEmi(e.target.value === 'yes')}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-is-emi">
                          <option value="no">No — Full Payment</option>
                          <option value="yes">Yes — EMI / Installment</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {(programType === 'Personal Session' || programType === 'Flagship Program') && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Is this EMI payment?</label>
                        <select value={isEmi ? 'yes' : 'no'} onChange={e => setIsEmi(e.target.value === 'yes')}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-is-emi-2">
                          <option value="no">No — Full Payment</option>
                          <option value="yes">Yes — EMI / Installment</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {isEmi && (
                    <div className="grid grid-cols-2 gap-3 bg-purple-50/50 border border-purple-100 rounded-lg p-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Total EMI Months *</label>
                        <select value={emiMonths} onChange={e => setEmiMonths(e.target.value)}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-emi-months">
                          <option value="">Select</option>
                          {EMI_MONTHS.map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-700 block mb-1">Months Covered (Paid) *</label>
                        <select value={emiMonthsCovered} onChange={e => setEmiMonthsCovered(e.target.value)}
                          className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                          data-testid="manual-emi-covered">
                          <option value="">Select</option>
                          {EMI_MONTHS.filter(m => !emiMonths || m <= parseInt(emiMonths)).map(m => (
                            <option key={m} value={m}>{m} of {emiMonths || '?'} month{m > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                </>
                )}

                {/* Payment proof — same field order for public page and Divine Cart embed */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Your Name *</label>
                      <Input
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="Full name"
                        className="text-xs h-9"
                        data-testid={isEmbed ? 'manual-payer-name-embed' : 'manual-payer-name'}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Date *</label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="text-xs h-9"
                        data-testid={isEmbed ? 'manual-payment-date-embed' : 'manual-payment-date'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Transaction ID *</label>
                      <Input
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="UTR / Reference No."
                        className="text-xs h-9"
                        data-testid={isEmbed ? 'manual-txn-id-embed' : 'manual-txn-id'}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Amount paid ({quoteCurrency}) *</label>
                      <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Amount"
                        className="text-xs h-9"
                        data-testid={isEmbed ? 'manual-amount-embed' : 'manual-amount'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Method *</label>
                    {payRail === 'gpay' ? (
                      <div
                        className="w-full border rounded-lg text-xs h-9 px-3 flex items-center text-gray-700 bg-slate-50 border-slate-200"
                        data-testid={isEmbed ? 'manual-payment-method-embed' : 'manual-payment-method'}
                      >
                        UPI / GPay <span className="text-[10px] text-gray-500 ml-2">(set by your admin)</span>
                      </div>
                    ) : payRail === 'bank' ? (
                      <div
                        className="w-full border rounded-lg text-xs h-9 px-3 flex items-center text-gray-700 bg-slate-50 border-slate-200"
                        data-testid={isEmbed ? 'manual-payment-method-embed' : 'manual-payment-method'}
                      >
                        Bank transfer <span className="text-[10px] text-gray-500 ml-2">(set by your admin)</span>
                      </div>
                    ) : (
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                        data-testid={isEmbed ? 'manual-payment-method-embed' : 'manual-payment-method'}
                      >
                        <option value="bank_transfer">Bank Transfer (NEFT/IMPS/RTGS)</option>
                        <option value="upi">UPI / GPay</option>
                        <option value="cash_deposit">Cash Deposit</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    )}
                  </div>

                  {!isUpiMethod && !hasBank && (
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Bank / App *</label>
                      <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g., HDFC, ICICI"
                        className="text-xs h-9"
                        data-testid={isEmbed ? 'manual-bank-name-embed' : 'manual-bank-name'}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">{notesLabel}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={notesPlaceholder}
                      rows={3}
                      className="w-full border rounded-lg text-xs px-3 py-2 text-gray-700 resize-y min-h-[4.5rem] focus:ring-1 focus:ring-[#D4AF37]"
                      data-testid={isEmbed ? 'manual-notes-embed' : 'manual-notes'}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">
                      Payment screenshot{screenshotRequired ? ' *' : ' (optional)'}
                    </label>
                    <p className="text-[10px] text-gray-500 mb-1">
                      Drag and drop an image here, tap the dashed area, or use Choose file. Required for cheque and cash deposit only.
                    </p>
                    <div
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProofDropActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!e.currentTarget.contains(e.relatedTarget)) setProofDropActive(false);
                      }}
                      onDragOver={handleProofDragOver}
                      onDrop={handleProofDrop}
                      className={`rounded-lg transition-colors ${proofDropActive ? 'ring-2 ring-[#D4AF37] ring-offset-1 bg-amber-50/50' : ''}`}
                    >
                      <label className="flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/80 p-3 transition-colors hover:border-[#D4AF37]/80">
                        {screenshotPreview ? (
                          <img src={screenshotPreview} alt="" className="max-h-36 mx-auto rounded object-contain pointer-events-none" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-2 text-gray-400 pointer-events-none">
                            <Upload size={20} className="mx-auto" />
                            <p className="text-xs">Drop image, tap here, or browse</p>
                          </div>
                        )}
                        <input
                          ref={proofFileRef}
                          type="file"
                          accept="image/*"
                          data-testid={isEmbed ? 'manual-proof-screenshot-embed' : 'manual-proof-screenshot'}
                          className="block w-full min-h-10 cursor-pointer text-xs text-gray-700 file:mr-3 file:inline-flex file:h-9 file:cursor-pointer file:items-center file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-amber-50/80"
                          onChange={handleScreenshot}
                        />
                      </label>
                    </div>
                    {screenshot ? (
                      <button
                        type="button"
                        className="mt-1.5 text-[10px] text-gray-500 underline"
                        onClick={clearScreenshot}
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-2"
                    data-testid={isEmbed ? 'manual-submit-btn-embed' : 'manual-submit-btn'}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-2" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Check size={14} className="mr-2" /> Submit Payment Proof
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {!isEmbed && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-28">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-[#D4AF37]" />
                  {enrollment ? 'Enrollment Details' : 'Payment Info'}
                </h3>

                <div className="space-y-3">
                  {programTitle && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Program</p>
                      <p className="text-sm font-semibold text-gray-900">{programTitle}</p>
                    </div>
                  )}

                  {enrollmentId && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Enrollment ID</p>
                      <p className="text-xs font-mono text-purple-700">{enrollmentId}</p>
                    </div>
                  )}

                  {enrollment?.booker_name && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Booked By</p>
                      <p className="text-xs text-gray-700">{enrollment.booker_name}</p>
                    </div>
                  )}

                  {/* Program/Session Dates */}
                  {itemDetails && (
                    <div className="border-t pt-3 space-y-2">
                      {itemDetails.start_date && (
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} className="text-purple-400" />
                          <span className="text-gray-500">Start:</span>
                          <span className="font-medium text-gray-900">{formatDateDdMonYyyy(itemDetails.start_date) || '—'}</span>
                        </div>
                      )}
                      {itemDetails.end_date && (
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} className="text-purple-400" />
                          <span className="text-gray-500">End:</span>
                          <span className="font-medium text-gray-900">{formatDateDdMonYyyy(itemDetails.end_date) || '—'}</span>
                        </div>
                      )}
                      {itemDetails.duration && (
                        <div className="flex items-center gap-2 text-xs">
                          <Clock size={12} className="text-purple-400" />
                          <span className="text-gray-500">Duration:</span>
                          <span className="font-medium text-gray-900">{itemDetails.duration}</span>
                        </div>
                      )}
                      {itemDetails.timing && (
                        <div className="flex items-center gap-2 text-xs">
                          <Clock size={12} className="text-purple-400" />
                          <span className="text-gray-500">Timing:</span>
                          <span className="font-medium text-gray-900">{itemDetails.timing}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {enrollment?.participants?.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Participants ({enrollment.participants.length})</p>
                      {enrollment.participants.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                          <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] flex items-center justify-center font-bold">{i + 1}</span>
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!enrollment && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 mt-2">
                      <p className="text-[10px] text-purple-600">This is a standalone payment form. Fill in the details on the left and submit your proof.</p>
                    </div>
                  )}
                </div>

                {!hasBank && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-500 mt-0.5" />
                      <p className="text-[10px] text-amber-700">Bank details not configured. Please contact admin for transfer details.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
    </div>
  );
}
