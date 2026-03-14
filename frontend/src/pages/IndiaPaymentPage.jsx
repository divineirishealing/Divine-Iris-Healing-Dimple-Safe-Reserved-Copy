import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  IndianRupee, QrCode, Upload, Calendar,
  MapPin, User, FileText, ChevronLeft, Loader2, Check,
  AlertCircle, Clock
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

  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Proof form state
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      setSettings(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Calculate adjusted pricing
  const pricing = useMemo(() => {
    const altDiscount = settings.india_alt_discount_percent || 9;
    const gstPct = settings.india_gst_percent || 18;

    const effectiveBase = Math.max(0, basePrice - promoDiscount - autoDiscount);
    const discountedBase = effectiveBase * (1 - altDiscount / 100);
    const gstAmount = discountedBase * gstPct / 100;
    const total = discountedBase + gstAmount;

    return {
      originalBase: basePrice,
      promoDiscount,
      autoDiscount,
      effectiveBase,
      altDiscountPct: altDiscount,
      altDiscountAmt: effectiveBase - discountedBase,
      discountedBase,
      gstPct,
      gstAmount,
      total: Math.round(total),
    };
  }, [basePrice, promoDiscount, autoDiscount, settings]);

  const handleScreenshot = (e) => {
    const file = e.target.files[0];
    if (file) {
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
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

      await axios.post(`${API}/india-payments/submit-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
      toast({ title: 'Payment proof submitted!' });
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
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
            You will receive a confirmation email once approved by the admin.
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

  const upiId = settings.india_upi_id || '';

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
                  Pay via GPay / UPI
                </h1>
                <p className="text-xs text-gray-500 mb-5">Complete the payment using UPI, then submit your proof below.</p>

                {/* UPI / GPay */}
                {upiId ? (
                  <div className="border rounded-lg p-4 mb-3" data-testid="upi-payment">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <QrCode size={18} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">GPay / UPI</p>
                        <div className="bg-gray-50 border rounded-lg p-3 mb-2">
                          <p className="text-[10px] text-gray-500 mb-0.5">UPI ID</p>
                          <p className="text-sm font-mono font-bold text-gray-900 select-all">{upiId}</p>
                        </div>
                        {/* QR Code */}
                        <div className="flex justify-center">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${encodeURIComponent(upiId)}&pn=DivineIrisHealing&am=${pricing.total}&cu=INR`}
                            alt="UPI QR Code"
                            className="rounded-lg border"
                            width={180}
                            height={180}
                            data-testid="upi-qr-code"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-2">Scan with any UPI app (GPay, PhonePe, Paytm)</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                    <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">UPI payment not configured yet. Please contact us.</p>
                  </div>
                )}
              </div>

              {/* Proof Submission Form */}
              <div className="bg-white rounded-xl shadow-sm border p-6" data-testid="proof-form">
                <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Upload size={16} className="text-[#D4AF37]" />
                  Submit Payment Proof
                </h2>
                <p className="text-[10px] text-gray-500 mb-4">After completing payment, fill in the details below and upload a screenshot.</p>

                <div className="space-y-3">
                  {/* Screenshot Upload */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Screenshot *</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#D4AF37] transition-colors cursor-pointer"
                      onClick={() => document.getElementById('proof-screenshot').click()}>
                      {screenshotPreview ? (
                        <img src={screenshotPreview} alt="Screenshot" className="max-h-40 mx-auto rounded" />
                      ) : (
                        <>
                          <Upload size={20} className="text-gray-300 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Click to upload screenshot</p>
                        </>
                      )}
                    </div>
                    <input type="file" id="proof-screenshot" accept="image/*" className="hidden" onChange={handleScreenshot} data-testid="proof-screenshot-input" />
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
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Bank / App Name *</label>
                      <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g., HDFC, GPay, PhonePe" className="text-xs h-9" data-testid="proof-bank-name" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Transaction ID *</label>
                      <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UTR / Reference No." className="text-xs h-9" data-testid="proof-txn-id" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Program *</label>
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
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-xs bg-white h-9" data-testid="proof-payment-method">
                      <option value="">Select method</option>
                      <option value="exly">Exly</option>
                      <option value="gpay">Google Pay (UPI)</option>
                      <option value="phonepe">PhonePe</option>
                      <option value="paytm">Paytm</option>
                      <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <Button onClick={handleSubmit} disabled={submitting}
                    className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-2"
                    data-testid="submit-proof-btn">
                    {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Submitting...</> : <><Check size={14} className="mr-2" /> Submit Payment Proof</>}
                  </Button>
                </div>
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
                    <span>Alt. Payment Discount ({pricing.altDiscountPct}%)</span>
                    <span>- INR {Math.round(pricing.altDiscountAmt).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxable Amount</span>
                    <span className="text-gray-900 font-medium">INR {Math.round(pricing.discountedBase).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">GST ({pricing.gstPct}%)</span>
                    <span className="text-gray-900">+ INR {Math.round(pricing.gstAmount).toLocaleString()}</span>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-gray-900">Total Payable</span>
                      <span className="text-[#D4AF37]">INR {pricing.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-[10px] text-green-700 font-medium mb-0.5">You save INR {Math.round(pricing.altDiscountAmt).toLocaleString()} with India payment!</p>
                  <p className="text-[10px] text-green-600">{pricing.altDiscountPct}% discount applied for alternative payment method.</p>
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
