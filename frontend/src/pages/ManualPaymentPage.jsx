import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Building2, Upload, User, FileText, Check,
  Loader2, Calendar, Clock, AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ManualPaymentPage = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [settings, setSettings] = useState({});
  const [enrollment, setEnrollment] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, enrollRes] = await Promise.all([
          axios.get(`${API}/settings`),
          axios.get(`${API}/enrollment/${enrollmentId}`)
        ]);
        setSettings(settingsRes.data);
        const e = enrollRes.data;
        setEnrollment(e);
        setPayerName(e.booker_name || '');

        // Fetch program/session details for dates
        const ep = e.item_type === 'program' ? 'programs' : 'sessions';
        try {
          const itemRes = await axios.get(`${API}/${ep}/${e.item_id}`);
          setItemDetails(itemRes.data);
        } catch {}
      } catch {
        toast({ title: 'Could not load enrollment details', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [enrollmentId]);

  const handleScreenshot = (e) => {
    const file = e.target.files[0];
    if (file) {
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!screenshot || !payerName || !paymentDate || !transactionId || !amount) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', screenshot);
      formData.append('enrollment_id', enrollmentId);
      formData.append('payer_name', payerName);
      formData.append('payment_date', paymentDate);
      formData.append('bank_name', bankName);
      formData.append('transaction_id', transactionId);
      formData.append('amount', amount);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('payment_method', paymentMethod);
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

  if (loading) return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center pt-24">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
      <Footer />
    </>
  );

  if (submitted) return (
    <>
      <Header />
      <div className="min-h-screen flex items-center justify-center pt-24 pb-16 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Proof Submitted</h1>
          <p className="text-sm text-gray-500 mb-6">Your payment proof has been submitted for verification. You'll receive a confirmation once approved.</p>
          <Button onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full px-8">
            Back to Home
          </Button>
        </div>
      </div>
      <Footer />
    </>
  );

  const bankDetails = settings.india_bank_details || {};
  const hasBank = !!bankDetails.account_number;
  const programTitle = enrollment?.item_title || itemDetails?.title || 'Unknown Program';

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-28 pb-16 px-4" data-testid="manual-payment-page">
        <div className="max-w-4xl mx-auto">

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h1 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Building2 size={20} className="text-[#D4AF37]" />
                  Submit Manual Payment
                </h1>
                <p className="text-xs text-gray-500 mb-5">Upload your payment proof for admin approval.</p>

                {/* Bank Details */}
                {hasBank && (
                  <div className="border rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={16} className="text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Bank Transfer Details</h3>
                    </div>
                    <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                      {bankDetails.account_name && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Account Name</span>
                          <span className="font-semibold text-gray-900 select-all">{bankDetails.account_name}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Account Number</span>
                        <span className="font-mono font-semibold text-gray-900 select-all">{bankDetails.account_number}</span>
                      </div>
                      {bankDetails.ifsc && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">IFSC Code</span>
                          <span className="font-mono font-semibold text-gray-900 select-all">{bankDetails.ifsc}</span>
                        </div>
                      )}
                      {bankDetails.bank_name && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Bank</span>
                          <span className="font-semibold text-gray-900">{bankDetails.bank_name}</span>
                        </div>
                      )}
                      {bankDetails.branch && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Branch</span>
                          <span className="font-semibold text-gray-900">{bankDetails.branch}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Proof Form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Screenshot *</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-[#D4AF37] transition-colors cursor-pointer"
                      onClick={() => document.getElementById('manual-proof-screenshot').click()}>
                      {screenshotPreview ? (
                        <img src={screenshotPreview} alt="Screenshot" className="max-h-32 mx-auto rounded" />
                      ) : (
                        <>
                          <Upload size={20} className="text-gray-300 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Click to upload screenshot</p>
                        </>
                      )}
                    </div>
                    <input type="file" id="manual-proof-screenshot" accept="image/*" className="hidden" onChange={handleScreenshot} data-testid="manual-proof-screenshot" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Your Name *</label>
                      <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Full name" className="text-xs h-9" data-testid="manual-payer-name" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Date *</label>
                      <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="text-xs h-9" data-testid="manual-payment-date" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Bank / App *</label>
                      <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g., HDFC, GPay" className="text-xs h-9" data-testid="manual-bank-name" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Transaction ID *</label>
                      <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UTR / Reference No." className="text-xs h-9" data-testid="manual-txn-id" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Amount Paid (INR) *</label>
                      <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="text-xs h-9" data-testid="manual-amount" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">Payment Method *</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full border rounded-lg text-xs h-9 px-3 text-gray-700 focus:ring-1 focus:ring-[#D4AF37]"
                        data-testid="manual-payment-method">
                        <option value="bank_transfer">Bank Transfer (NEFT/IMPS/RTGS)</option>
                        <option value="upi">UPI</option>
                        <option value="cash_deposit">Cash Deposit</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">City</label>
                      <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" className="text-xs h-9" data-testid="manual-city" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-700 block mb-1">State</label>
                      <Input value={state} onChange={e => setState(e.target.value)} placeholder="Your state" className="text-xs h-9" data-testid="manual-state" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-700 block mb-1">Additional Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Any additional details..."
                      rows={2} className="w-full border rounded-lg text-xs px-3 py-2 text-gray-700 resize-none focus:ring-1 focus:ring-[#D4AF37]"
                      data-testid="manual-notes" />
                  </div>

                  <Button onClick={handleSubmit} disabled={submitting}
                    className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-2"
                    data-testid="manual-submit-btn">
                    {submitting ? <><Loader2 size={14} className="animate-spin mr-2" /> Submitting...</> : <><Check size={14} className="mr-2" /> Submit Payment Proof</>}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Program Details */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-5 sticky top-28">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-[#D4AF37]" />
                  Enrollment Details
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Program</p>
                    <p className="text-sm font-semibold text-gray-900">{programTitle}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Enrollment ID</p>
                    <p className="text-xs font-mono text-purple-700">{enrollmentId}</p>
                  </div>

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
                          <span className="text-gray-500">Start Date:</span>
                          <span className="font-medium text-gray-900">{new Date(itemDetails.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                      {itemDetails.end_date && (
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} className="text-purple-400" />
                          <span className="text-gray-500">End Date:</span>
                          <span className="font-medium text-gray-900">{new Date(itemDetails.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ManualPaymentPage;
