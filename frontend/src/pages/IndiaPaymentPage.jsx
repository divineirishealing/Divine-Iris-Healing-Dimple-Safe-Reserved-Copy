import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parseIndiaSitePercent, resolveIndiaDiscountPercent } from '../lib/indiaClientPricing';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  IndianRupee, Building2, ExternalLink, Upload,
  User, FileText, CreditCard, ChevronLeft, Loader2, Check,
  AlertCircle, Clock, Smartphone, Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const IndiaPaymentPage = () => {
  const { enrollmentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const programTitle = searchParams.get('program') || '';
  const basePrice = parseFloat(searchParams.get('price') || '0');
  const promoDiscount = parseFloat(searchParams.get('promo_discount') || '0');
  const autoDiscount = parseFloat(searchParams.get('auto_discount') || '0');
  const isManualMode = searchParams.get('mode') === 'manual';

  const [settings, setSettings] = useState({});
  const [clientTax, setClientTax] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeMethod, setActiveMethod] = useState('exly');
  const [paymentMethod, setPaymentMethod] = useState('gpay_upi');

  // Proof form state (for bank transfer only)
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const proofFileRef = useRef(null);
  const [payerName, setPayerName] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [settingsRes, taxRes] = await Promise.all([
          axios.get(`${API}/settings`),
          enrollmentId
            ? axios.get(`${API}/india-payments/client-tax/${enrollmentId}`).catch(() => ({ data: null }))
            : Promise.resolve({ data: null }),
        ]);
        const s = settingsRes.data;
        const ct = taxRes.data;
        setSettings(s);
        setClientTax(ct);

        // Pre-select the active method tab based on the client's tagged payment method
        const tagged = (ct?.india_payment_method || '').toLowerCase();
        if (isManualMode) {
          setActiveMethod('bank');
        } else if (tagged === 'gpay_upi' || tagged === 'gpay' || tagged === 'upi') {
          const hasGpay = (s.india_gpay_accounts || []).some(g => (g.upi_id || '').trim());
          setActiveMethod(hasGpay ? 'gpay' : 'bank');
        } else if (tagged === 'bank_transfer') {
          setActiveMethod('bank');
        } else if (tagged === 'stripe') {
          setActiveMethod('exly');
        } else if (!s.india_exly_link && s.india_bank_details?.account_number) {
          setActiveMethod('bank');
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isManualMode, enrollmentId]);

  const pricing = useMemo(() => {
    const platformPct = (() => {
      const v = Number(settings.india_platform_charge_percent);
      return Number.isFinite(v) ? v : 3;
    })();

    const participantCount = clientTax?.participant_count ?? 1;
    const altDisc = parseIndiaSitePercent(settings, 'india_alt_discount_percent', 9);
    const r = resolveIndiaDiscountPercent(clientTax || {}, participantCount, altDisc);
    const discountPct = r.discountPct;
    const hasIndiaDiscount =
      r.fromBand ||
      !!(clientTax && clientTax.india_discount_percent != null && clientTax.india_discount_percent !== '');
    const discountLabel = hasIndiaDiscount ? 'India Discount' : 'Alt. Payment Discount';

    // Client-specific tax (GST on after-discount price)
    const taxEnabled = clientTax ? !!clientTax.india_tax_enabled : true;
    const gstPct = taxEnabled
      ? (clientTax?.india_tax_enabled ? (clientTax.india_tax_percent ?? 18) : (settings.india_gst_percent || 18))
      : 0;
    const taxLabel = clientTax?.india_tax_label || 'GST';

    const effectiveBase = Math.max(0, basePrice - promoDiscount - autoDiscount);
    const discountAmt = effectiveBase * discountPct / 100;
    const taxableBase = effectiveBase - discountAmt;           // after discount
    const gstAmount = taxableBase * gstPct / 100;             // GST on after-discount
    const platformAmount = taxableBase * platformPct / 100;
    const total = taxableBase + gstAmount + platformAmount;
    return {
      originalBase: basePrice,
      promoDiscount,
      autoDiscount,
      effectiveBase,
      discountPct,
      discountLabel,
      discountAmt,
      taxableBase,
      taxEnabled,
      taxLabel,
      gstPct,
      gstAmount,
      platformPct,
      platformAmount,
      total: Math.round(total),
    };
  }, [basePrice, promoDiscount, autoDiscount, settings, clientTax]);

  const handleScreenshot = (e) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setScreenshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setScreenshot(file);
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

  const handleSubmitProof = async () => {
    if (!screenshot) return toast({ title: 'Please upload payment screenshot', variant: 'destructive' });
    if (!payerName || !paymentDate || !bankName || !transactionId || !amount || !city || !state) {
      return toast({ title: 'Please fill all required fields', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('enrollment_id', enrollmentId);
      formData.append('payer_name', payerName);
      formData.append('payment_date', paymentDate);
      formData.append('bank_name', bankName);
      formData.append('transaction_id', transactionId);
      formData.append('program_title', programTitle);
      formData.append('amount', amount);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('payment_method', paymentMethod);
      formData.append('screenshot', screenshot);
      if (notes) formData.append('notes', notes);
      await axios.post(`${API}/india-payments/submit-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
      toast({ title: 'Payment proof submitted!' });
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Failed to submit', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
    </div>
  );

  if (submitted) return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-28 pb-16 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Proof Submitted</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your payment proof has been submitted for verification.
            You will receive a confirmation email once approved.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-amber-800 flex items-center gap-1.5 mb-1"><Clock size={12} /> Estimated verification time: 24-48 hours</p>
            <p className="text-[10px] text-amber-600">We'll send your participant ID and receipt via email after approval.</p>
          </div>
          <Button onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full px-8">
            Back to Home
          </Button>
        </div>
      </div>
      <Footer />
    </>
  );

  const exlyLink = settings.india_exly_link || '';
  const bankDetails = settings.india_bank_details || {};
  const hasExly = !!exlyLink;
  const hasBank = !!bankDetails.account_number;
  const gpayAccounts = (settings.india_gpay_accounts || []).filter(g => (g.upi_id || '').trim());
  const bankAccounts = settings.india_bank_accounts || [];
  const hasGpay = gpayAccounts.length > 0;
  // Effective bank details: prefer multi-account array, fall back to legacy single field
  const effectiveBanks = bankAccounts.length > 0 ? bankAccounts : (hasBank ? [bankDetails] : []);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-28 pb-16 px-4" data-testid="india-payment-page">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ChevronLeft size={16} /> Back
          </button>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Payment Methods */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h1 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <IndianRupee size={20} className="text-[#D4AF37]" />
                  {isManualMode ? 'Submit Manual Payment' : 'India Payment Options'}
                </h1>
                <p className="text-xs text-gray-500 mb-5">{isManualMode ? 'Upload your payment proof for admin approval.' : 'Choose a payment method to complete your enrollment.'}</p>

                {/* Method Tabs — hide in manual mode, show only relevant tabs */}
                {!isManualMode && (hasGpay || (hasExly && (hasBank || effectiveBanks.length > 0))) && (
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {hasGpay && (
                      <button onClick={() => setActiveMethod('gpay')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all border ${activeMethod === 'gpay' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        data-testid="tab-gpay">
                        <Smartphone size={14} className="inline mr-1.5" /> GPay / UPI
                      </button>
                    )}
                    {effectiveBanks.length > 0 && (
                      <button onClick={() => setActiveMethod('bank')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all border ${activeMethod === 'bank' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        data-testid="tab-bank">
                        <Building2 size={14} className="inline mr-1.5" /> Bank Transfer
                      </button>
                    )}
                    {hasExly && (
                      <button onClick={() => setActiveMethod('exly')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all border ${activeMethod === 'exly' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        data-testid="tab-exly">
                        <CreditCard size={14} className="inline mr-1.5" /> Pay via Exly
                      </button>
                    )}
                  </div>
                )}

                {/* GPay / UPI Payment */}
                {activeMethod === 'gpay' && hasGpay && (
                  <div data-testid="gpay-payment">
                    <div className="border rounded-xl p-5 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone size={16} className="text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">GPay / UPI Transfer</h3>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-4">
                        Send <strong className="text-[#D4AF37]">INR {pricing.total.toLocaleString()}</strong> to the UPI ID below, then submit proof below.
                      </p>
                      <div className="space-y-3">
                        {gpayAccounts.map((acct, i) => (
                          <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-4">
                            {acct.label && (
                              <p className="text-[10px] font-semibold text-green-700 mb-2 uppercase tracking-wide">{acct.label}</p>
                            )}
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono font-bold text-sm text-gray-900 select-all break-all">{acct.upi_id}</span>
                              <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(acct.upi_id); toast({ title: 'UPI ID copied!' }); }}
                                className="shrink-0 flex items-center gap-1 text-[10px] bg-white border border-green-300 text-green-700 px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
                              >
                                <Copy size={11} /> Copy
                              </button>
                            </div>
                            {acct.qr_image_url && (
                              <div className="mt-3 flex justify-center">
                                <img src={acct.qr_image_url} alt="UPI QR Code" className="w-36 h-36 object-contain rounded border" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Exly Payment */}
                {(activeMethod === 'exly' && hasExly) && (
                  <div data-testid="exly-payment">
                    <div className="border-2 border-purple-200 rounded-xl p-6 bg-purple-50/30 text-center">
                      <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <CreditCard size={24} className="text-purple-600" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">Pay Securely via Exly</h3>
                      <p className="text-[10px] text-gray-500 mb-4">Exly supports GPay, Debit Cards, Credit Cards & more. Your payment is processed securely.</p>
                      <p className="text-lg font-bold text-[#D4AF37] mb-4">INR {pricing.total.toLocaleString()}</p>
                      <a href={exlyLink.startsWith('http') ? exlyLink : `https://${exlyLink}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-8 py-3 rounded-full transition-colors"
                        data-testid="exly-pay-btn">
                        Pay INR {pricing.total.toLocaleString()} on Exly <ExternalLink size={14} />
                      </a>
                      <p className="text-[9px] text-gray-400 mt-3">You'll be redirected to Exly's secure payment page</p>
                    </div>
                  </div>
                )}

                {/* Bank Transfer / Manual Payment */}
                {(activeMethod === 'bank' && (effectiveBanks.length > 0 || isManualMode)) && (
                  <div data-testid="bank-payment">
                    {/* Bank Details — show all configured accounts */}
                    {effectiveBanks.length > 0 && (
                    <div className="border rounded-xl p-5 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 size={16} className="text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Bank Transfer (NEFT / IMPS / RTGS)</h3>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-3">Transfer <strong className="text-[#D4AF37]">INR {pricing.total.toLocaleString()}</strong> to the following account:</p>
                      <div className="space-y-3">
                        {effectiveBanks.map((bd, i) => (
                          <div key={i} className="bg-gray-50 border rounded-lg p-4 space-y-2">
                            {bd.label && effectiveBanks.length > 1 && (
                              <p className="text-[10px] font-semibold text-blue-700 mb-1 uppercase tracking-wide">{bd.label}</p>
                            )}
                            {bd.account_name && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Account Name</span>
                                <span className="font-semibold text-gray-900 select-all">{bd.account_name}</span>
                              </div>
                            )}
                            {bd.account_number && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Account Number</span>
                                <span className="font-mono font-semibold text-gray-900 select-all">{bd.account_number}</span>
                              </div>
                            )}
                            {bd.ifsc && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">IFSC Code</span>
                                <span className="font-mono font-semibold text-gray-900 select-all">{bd.ifsc}</span>
                              </div>
                            )}
                            {bd.bank_name && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Bank</span>
                                <span className="font-semibold text-gray-900">{bd.bank_name}</span>
                              </div>
                            )}
                            {bd.branch && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Branch</span>
                                <span className="font-semibold text-gray-900">{bd.branch}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    )}

                    {/* Proof Submission Form */}
                    <div className="border rounded-xl p-5" data-testid="proof-form">
                      <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <Upload size={14} className="text-[#D4AF37]" />
                        Submit Payment Proof
                      </h3>
                      <p className="text-[10px] text-gray-500 mb-4">After completing bank transfer, fill in the details and upload a screenshot.</p>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Screenshot *</label>
                          <p className="text-[10px] text-gray-500 mb-1">
                            Use Browse / Choose File below (phone, tablet, or laptop).
                          </p>
                          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/80 p-3 transition-colors hover:border-[#D4AF37]/80">
                            {screenshotPreview ? (
                              <img src={screenshotPreview} alt="" className="max-h-32 mx-auto rounded object-contain" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 py-2 text-gray-400">
                                <Upload size={20} />
                                <p className="text-xs">Add screenshot</p>
                              </div>
                            )}
                            <input
                              ref={proofFileRef}
                              type="file"
                              accept="image/*"
                              data-testid="proof-screenshot-input"
                              className="block w-full min-h-10 cursor-pointer text-xs text-gray-700 file:mr-3 file:inline-flex file:h-9 file:cursor-pointer file:items-center file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-amber-50/80"
                              onChange={handleScreenshot}
                            />
                          </label>
                          {screenshot ? (
                            <button type="button" className="mt-1.5 text-[10px] text-gray-500 underline" onClick={clearScreenshot}>
                              Remove image
                            </button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Your Name *</label>
                            <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Full name" className="text-xs h-9" data-testid="proof-payer-name" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Date *</label>
                            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="text-xs h-9" data-testid="proof-payment-date" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Bank / App *</label>
                            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g., HDFC, SBI" className="text-xs h-9" data-testid="proof-bank-name" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Transaction ID *</label>
                            <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UTR / Reference No." className="text-xs h-9" data-testid="proof-txn-id" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Program</label>
                            <Input value={programTitle} readOnly className="text-xs h-9 bg-gray-50" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">Amount Paid (INR) *</label>
                            <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder={`${pricing.total}`} className="text-xs h-9" data-testid="proof-amount" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">City *</label>
                            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" className="text-xs h-9" data-testid="proof-city" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-700 block mb-1">State *</label>
                            <Input value={state} onChange={e => setState(e.target.value)} placeholder="Your state" className="text-xs h-9" data-testid="proof-state" />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Method *</label>
                          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                            data-testid="proof-payment-method">
                            <option value="gpay_upi">GPay / UPI</option>
                            <option value="bank_transfer">Bank Transfer (NEFT/IMPS/RTGS)</option>
                            <option value="cash_deposit">Cash Deposit</option>
                            <option value="cheque">Cheque</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-gray-700 block mb-1">Additional Notes</label>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Any additional details about your payment..."
                            rows={2} className="w-full border rounded-lg text-xs px-3 py-2 text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37]"
                            data-testid="proof-notes" />
                        </div>

                        <Button onClick={handleSubmitProof} disabled={submitting}
                          className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-2"
                          data-testid="submit-proof-btn">
                          {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Submitting...</> : <><Check size={14} className="mr-2" /> Submit Payment Proof</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!hasExly && !hasBank && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                    <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No India payment methods configured. Please contact us.</p>
                  </div>
                )}

                {/* Show only Exly if no bank, or only bank if no Exly */}
                {hasExly && !hasBank && activeMethod !== 'exly' && setActiveMethod('exly')}
                {!hasExly && hasBank && activeMethod !== 'bank' && setActiveMethod('bank')}
              </div>
            </div>

            {/* Right: Price Breakdown */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-28">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-[#D4AF37]" />
                  Payment Summary
                </h3>
                <p className="text-xs font-medium text-gray-700 mb-3">{programTitle}</p>

                <div className="space-y-2 text-xs border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Price (INR)</span>
                    <span className="text-gray-900 font-medium">INR {pricing.originalBase.toLocaleString()}</span>
                  </div>

                  {pricing.promoDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo Discount</span>
                      <span>- INR {pricing.promoDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {pricing.autoDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Additional Discount</span>
                      <span>- INR {pricing.autoDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  {(pricing.promoDiscount > 0 || pricing.autoDiscount > 0) && (
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-500">After Discount</span>
                      <span className="text-gray-900">INR {pricing.effectiveBase.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-green-600">
                    <span>{pricing.discountLabel} ({pricing.discountPct}%)</span>
                    <span>- INR {Math.round(pricing.discountAmt).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">After Discount</span>
                    <span className="text-gray-900 font-medium">INR {Math.round(pricing.taxableBase).toLocaleString()}</span>
                  </div>

                  {pricing.taxEnabled && pricing.gstPct > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{pricing.taxLabel} ({pricing.gstPct}%)</span>
                    <span className="text-gray-900">+ INR {Math.round(pricing.gstAmount).toLocaleString()}</span>
                  </div>
                  )}

                  {pricing.platformAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Platform Charges ({pricing.platformPct}%)</span>
                      <span className="text-gray-900">+ INR {Math.round(pricing.platformAmount).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-gray-900">Total Payable</span>
                      <span className="text-[#D4AF37]">INR {pricing.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-[10px] text-green-700 font-medium mb-0.5">You save INR {Math.round(pricing.discountAmt).toLocaleString()} with India payment!</p>
                  <p className="text-[10px] text-green-600">{pricing.discountPct}% discount applied on the base price.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default IndiaPaymentPage;
