import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { resolveImageUrl } from '../lib/imageUtils';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  User, Monitor, Wifi, Mail, Phone, CreditCard, Lock, Plus, Trash2,
  ChevronRight, ChevronLeft, Check, ShieldAlert, ShieldCheck, AlertTriangle, Loader2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "IN", name: "India", phone: "+91" },
  { code: "AE", name: "United Arab Emirates", phone: "+971" },
  { code: "US", name: "United States", phone: "+1" },
  { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "CA", name: "Canada", phone: "+1" },
  { code: "AU", name: "Australia", phone: "+61" },
  { code: "SG", name: "Singapore", phone: "+65" },
  { code: "DE", name: "Germany", phone: "+49" },
  { code: "FR", name: "France", phone: "+33" },
  { code: "SA", name: "Saudi Arabia", phone: "+966" },
  { code: "QA", name: "Qatar", phone: "+974" },
  { code: "KW", name: "Kuwait", phone: "+965" },
  { code: "OM", name: "Oman", phone: "+968" },
  { code: "BH", name: "Bahrain", phone: "+973" },
  { code: "PK", name: "Pakistan", phone: "+92" },
  { code: "BD", name: "Bangladesh", phone: "+880" },
  { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "NP", name: "Nepal", phone: "+977" },
  { code: "MY", name: "Malaysia", phone: "+60" },
  { code: "JP", name: "Japan", phone: "+81" },
  { code: "ZA", name: "South Africa", phone: "+27" },
  { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "KE", name: "Kenya", phone: "+254" },
].sort((a, b) => a.name.localeCompare(b.name));

const GENDERS = ["Female", "Male", "Non-Binary", "Prefer not to say"];
const RELATIONSHIPS = ["Myself", "Mother", "Father", "Sister", "Brother", "Spouse", "Husband", "Wife", "Friend", "Colleague", "Other"];

const emptyParticipant = () => ({ name: '', relationship: '', age: '', gender: '' });

const StepIndicator = ({ current, steps }) => (
  <div className="flex items-center justify-center mb-8" data-testid="step-indicator">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <div className="flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
            i < current ? 'bg-green-500 text-white' :
            i === current ? 'bg-[#D4AF37] text-white shadow-lg shadow-[#D4AF37]/30' :
            'bg-gray-200 text-gray-400'
          }`}>
            {i < current ? <Check size={16} /> : i + 1}
          </div>
          <span className={`text-[10px] mt-1 ${i <= current ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{s}</span>
        </div>
        {i < steps.length - 1 && (
          <div className={`w-10 md:w-16 h-0.5 mx-1 mt-[-14px] ${i < current ? 'bg-green-500' : 'bg-gray-200'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const ParticipantForm = ({ index, data, onChange, onRemove, canRemove }) => (
  <div className="border rounded-xl p-4 mb-3 bg-gray-50 relative" data-testid={`participant-${index}`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-[#D4AF37]">Participant {index + 1}</span>
      {canRemove && (
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 transition-colors" data-testid={`remove-participant-${index}`}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-[10px] text-gray-500 mb-0.5 block">Full Name *</label>
        <Input data-testid={`p-name-${index}`} value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} placeholder="Full name" className="text-sm" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Relationship to You *</label>
        <select data-testid={`p-relation-${index}`} value={data.relationship} onChange={e => onChange({ ...data, relationship: e.target.value })} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
          <option value="">Select...</option>
          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Age *</label>
        <Input data-testid={`p-age-${index}`} type="number" min="5" max="120" value={data.age} onChange={e => onChange({ ...data, age: e.target.value })} placeholder="Age" className="text-sm" />
      </div>
      <div className="col-span-2">
        <label className="text-[10px] text-gray-500 mb-0.5 block">Gender *</label>
        <select data-testid={`p-gender-${index}`} value={data.gender} onChange={e => onChange({ ...data, gender: e.target.value })} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
          <option value="">Select...</option>
          {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
    </div>
  </div>
);

function EnrollmentPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(null);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [pricing, setPricing] = useState(null);

  // Step 1
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [country, setCountry] = useState('AE');
  const [participants, setParticipants] = useState([emptyParticipant()]);

  // Step 2
  const [attendance, setAttendance] = useState('');
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Step 3
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+971');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [mockOtp, setMockOtp] = useState('');

  // Step 4
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const ep = type === 'program' ? 'programs' : 'sessions';
    axios.get(`${API}/${ep}/${id}`).then(r => setItem(r.data)).catch(() => navigate('/'));
  }, [id, type, navigate]);

  useEffect(() => {
    const c = COUNTRIES.find(c => c.code === country);
    if (c) setCountryCode(c.phone);
  }, [country]);

  const updateParticipant = (index, data) => {
    const updated = [...participants];
    updated[index] = data;
    setParticipants(updated);
  };

  const addParticipant = () => setParticipants([...participants, emptyParticipant()]);

  const removeParticipant = (index) => {
    if (participants.length <= 1) return;
    setParticipants(participants.filter((_, i) => i !== index));
  };

  // ─── Step 1 ───
  const submitProfile = async () => {
    if (!bookerName.trim()) return toast({ title: 'Enter your name', variant: 'destructive' });
    if (!bookerEmail.trim()) return toast({ title: 'Enter your email', variant: 'destructive' });

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name.trim()) return toast({ title: `Participant ${i + 1}: Enter name`, variant: 'destructive' });
      if (!p.relationship) return toast({ title: `Participant ${i + 1}: Select relationship`, variant: 'destructive' });
      if (!p.age || p.age < 5) return toast({ title: `Participant ${i + 1}: Enter valid age`, variant: 'destructive' });
      if (!p.gender) return toast({ title: `Participant ${i + 1}: Select gender`, variant: 'destructive' });
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName,
        booker_email: bookerEmail,
        country,
        participants: participants.map(p => ({ ...p, age: parseInt(p.age) })),
      });
      setEnrollmentId(res.data.enrollment_id);
      setVpnDetected(res.data.vpn_detected);
      if (res.data.vpn_detected) {
        toast({ title: 'VPN/Proxy Detected', description: 'Pricing will be in AED.', variant: 'destructive' });
      }
      setStep(1);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed to save', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ─── Step 2 ───
  const submitAttendance = async () => {
    if (!attendance) return toast({ title: 'Select a mode', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await axios.put(`${API}/enrollment/${enrollmentId}/attendance`, { mode: attendance });
      if (attendance === 'offline' && res.data.offline_info) {
        setShowOfflineModal(true);
      } else {
        setStep(2);
      }
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ─── Step 3 ───
  const sendOtp = async () => {
    if (!phone.trim() || phone.length < 7) return toast({ title: 'Enter valid phone number', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/send-otp`, { phone, country_code: countryCode });
      setOtpSent(true);
      if (res.data.mock_otp) setMockOtp(res.data.mock_otp);
      toast({ title: 'OTP Sent!', description: `Check ${res.data.phone}` });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast({ title: 'Enter 6-digit OTP', variant: 'destructive' });
    setLoading(true);
    try {
      await axios.post(`${API}/enrollment/${enrollmentId}/verify-otp`, { phone, country_code: countryCode, otp });
      setPhoneVerified(true);
      toast({ title: 'Phone verified!' });
      const pRes = await axios.get(`${API}/enrollment/${enrollmentId}/pricing?item_type=${type}&item_id=${id}`);
      setPricing(pRes.data);
      setStep(3);
    } catch (err) {
      toast({ title: 'Failed', description: err.response?.data?.detail || 'Wrong OTP', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ─── Step 4 ───
  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId, item_type: type, item_id: id, currency: pricing.pricing.currency,
      });
      window.location.href = res.data.url;
    } catch (err) {
      toast({ title: 'Payment Error', description: err.response?.data?.detail || 'Try again', variant: 'destructive' });
      setProcessing(false);
    }
  };

  if (!item) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" size={32} /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">

          <div className="text-center mb-6">
            <p className="text-[#D4AF37] text-xs tracking-[0.2em] uppercase mb-1">{type === 'program' ? 'Program Enrollment' : 'Session Booking'}</p>
            <h1 data-testid="enrollment-title" className="text-2xl md:text-3xl text-gray-900">{item.title}</h1>
          </div>

          <StepIndicator current={step} steps={['Participants', 'Mode', 'Verify', 'Pay']} />

          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">

            {vpnDetected && (
              <div data-testid="vpn-warning" className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 flex items-start gap-2">
                <ShieldAlert size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 text-sm font-semibold">VPN / Proxy Detected</p>
                  <p className="text-red-600 text-xs">Regional pricing unavailable. Standard AED rate applies.</p>
                </div>
              </div>
            )}

            {/* ═══ STEP 1: PARTICIPANTS ═══ */}
            {step === 0 && (
              <div data-testid="step-profile">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-[#D4AF37]/10 rounded-full flex items-center justify-center"><User size={18} className="text-[#D4AF37]" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Who is booking?</h2>
                    <p className="text-xs text-gray-500">Your details + people you're enrolling</p>
                  </div>
                </div>

                {/* Booker info */}
                <div className="border rounded-xl p-4 mb-4 bg-white">
                  <span className="text-xs font-semibold text-gray-700 block mb-3">Your Details (Booker)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Your Name *</label>
                      <Input data-testid="booker-name" value={bookerName} onChange={e => setBookerName(e.target.value)} placeholder="Your full name" className="text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Your Email *</label>
                      <Input data-testid="booker-email" type="email" value={bookerEmail} onChange={e => setBookerEmail(e.target.value)} placeholder="your@email.com" className="text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Your Country *</label>
                      <select data-testid="booker-country" value={country} onChange={e => setCountry(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">Participants ({participants.length})</span>
                  </div>
                  {participants.map((p, i) => (
                    <ParticipantForm key={i} index={i} data={p} onChange={d => updateParticipant(i, d)} onRemove={() => removeParticipant(i)} canRemove={participants.length > 1} />
                  ))}
                  <button
                    data-testid="add-participant-btn"
                    onClick={addParticipant}
                    className="w-full border-2 border-dashed border-[#D4AF37]/40 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors"
                  >
                    <Plus size={16} /> Add Another Person
                  </button>
                </div>

                <Button data-testid="step1-next" onClick={submitProfile} disabled={loading} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>Continue with {participants.length} participant{participants.length > 1 ? 's' : ''}</span> <ChevronRight size={18} className="ml-1" /></>}
                </Button>
              </div>
            )}

            {/* ═══ STEP 2: ATTENDANCE MODE ═══ */}
            {step === 1 && (
              <div data-testid="step-attendance">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-[#D4AF37]/10 rounded-full flex items-center justify-center"><Monitor size={18} className="text-[#D4AF37]" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Session Mode</h2>
                    <p className="text-xs text-gray-500">How would participants like to attend?</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button data-testid="mode-online" onClick={() => setAttendance('online')}
                    className={`p-5 rounded-xl border-2 transition-all text-center ${attendance === 'online' ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Monitor size={28} className={`mx-auto mb-2 ${attendance === 'online' ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                    <p className="font-semibold text-gray-900 text-sm">Online (Zoom)</p>
                    <p className="text-[10px] text-gray-500 mt-1">Join a live Zoom session from anywhere</p>
                  </button>
                  <button data-testid="mode-offline" onClick={() => setAttendance('offline')}
                    className={`p-5 rounded-xl border-2 transition-all text-center ${attendance === 'offline' ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-lg' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Wifi size={28} className={`mx-auto mb-2 ${attendance === 'offline' ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                    <p className="font-semibold text-gray-900 text-sm">Remote Healing</p>
                    <p className="text-[10px] text-gray-500 mt-1">No call needed — the healer works remotely</p>
                  </button>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0)} className="rounded-full"><ChevronLeft size={18} /> Back</Button>
                  <Button data-testid="step2-next" onClick={submitAttendance} disabled={loading || !attendance} className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><span>Continue</span> <ChevronRight size={18} /></>}
                  </Button>
                </div>

                {showOfflineModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl" data-testid="offline-modal">
                      <Wifi size={36} className="mx-auto text-[#D4AF37] mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">Remote Healing Session</h3>
                      <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm text-gray-700">
                        <p>This is a <strong>remote healing session</strong>. You do not need to join any call.</p>
                        <p>The healer will work on the participant's energy remotely during the scheduled time.</p>
                        <p className="text-gray-500 text-xs mt-2">Please ensure the participant is in a calm, comfortable space during the session time.</p>
                      </div>
                      <Button data-testid="offline-modal-confirm" onClick={() => { setShowOfflineModal(false); setStep(2); }} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full">
                        I Understand, Continue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 3: PHONE VERIFICATION ═══ */}
            {step === 2 && (
              <div data-testid="step-verify">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-[#D4AF37]/10 rounded-full flex items-center justify-center"><Phone size={18} className="text-[#D4AF37]" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Verify Your Phone</h2>
                    <p className="text-xs text-gray-500">We'll send a one-time code to confirm</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-gray-50 mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail size={14} className="text-green-500" />
                    <span className="text-sm text-gray-600">Email: <strong>{bookerEmail}</strong></span>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone size={14} className={phoneVerified ? 'text-green-500' : 'text-gray-400'} />
                    <span className="text-sm font-medium text-gray-700">Phone Number</span>
                    {phoneVerified && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>}
                  </div>

                  {!phoneVerified && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="border rounded-md px-2 py-2 text-sm w-24 bg-white">
                          {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
                        </select>
                        <Input data-testid="enroll-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone number" disabled={otpSent} className="flex-1" />
                        {!otpSent && (
                          <Button data-testid="send-otp-btn" onClick={sendOtp} disabled={loading} size="sm" className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                            {loading ? <Loader2 className="animate-spin" size={14} /> : 'Send OTP'}
                          </Button>
                        )}
                      </div>
                      {otpSent && (
                        <div>
                          <div className="flex gap-2">
                            <Input data-testid="enroll-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" maxLength={6} className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                            <Button data-testid="verify-otp-btn" onClick={verifyOtp} disabled={loading || otp.length !== 6} size="sm" className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                              {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}
                            </Button>
                          </div>
                          {mockOtp && (
                            <p data-testid="mock-otp-display" className="text-xs text-orange-500 mt-2 bg-orange-50 p-2 rounded text-center">
                              Test OTP: <strong className="font-mono">{mockOtp}</strong>
                            </p>
                          )}
                          <button onClick={() => { setOtpSent(false); setOtp(''); setMockOtp(''); }} className="text-xs text-[#D4AF37] mt-2 hover:underline">Resend OTP</button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-3 mt-5">
                  <Button variant="outline" onClick={() => setStep(1)} className="rounded-full"><ChevronLeft size={18} /> Back</Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: PAYMENT ═══ */}
            {step === 3 && pricing && (
              <div data-testid="step-billing">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-[#D4AF37]/10 rounded-full flex items-center justify-center"><CreditCard size={18} className="text-[#D4AF37]" /></div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Review & Pay</h2>
                    <p className="text-xs text-gray-500">Confirm details and complete payment</p>
                  </div>
                </div>

                {pricing.security?.fraud_warning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2" data-testid="fraud-warning">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800">{pricing.security.fraud_warning}</p>
                  </div>
                )}
                {pricing.security?.inr_eligible && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-2" data-testid="inr-eligible">
                    <ShieldCheck size={14} className="text-green-600 mt-0.5" />
                    <p className="text-xs text-green-800">India pricing verified. All checks passed.</p>
                  </div>
                )}

                {/* Order summary */}
                <div className="bg-gray-50 rounded-xl p-5 mb-5 border">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">{pricing.item.title}</h3>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{pricing.item.description}</p>

                  {/* Participants */}
                  <div className="border-t pt-3 mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Participants ({pricing.pricing.participant_count})</p>
                    {participants.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-600 py-1">
                        <span>{p.name} ({p.relationship})</span>
                        <span>{pricing.pricing.symbol}{pricing.pricing.final_per_person}</span>
                      </div>
                    ))}
                  </div>

                  {pricing.pricing.offer_price_per_person && (
                    <div className="text-xs text-red-500 text-right mb-1">{pricing.pricing.offer_text}</div>
                  )}

                  <div className="flex justify-between font-bold text-lg border-t pt-3">
                    <span className="text-gray-900">Total</span>
                    <span className="text-[#D4AF37]">{pricing.pricing.symbol}{pricing.pricing.total}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right mt-1">{pricing.pricing.currency.toUpperCase()} | {pricing.pricing.participant_count} person{pricing.pricing.participant_count > 1 ? 's' : ''}</p>
                </div>

                {/* Booker summary */}
                <div className="bg-gray-50 rounded-xl p-4 mb-5 border text-xs text-gray-600 space-y-1">
                  <p><strong>Booked by:</strong> {bookerName}</p>
                  <p><strong>Email:</strong> {bookerEmail}</p>
                  <p><strong>Phone:</strong> {countryCode}{phone}</p>
                  <p><strong>Mode:</strong> {attendance === 'online' ? 'Online (Zoom)' : 'Remote Healing'}</p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="rounded-full"><ChevronLeft size={18} /></Button>
                  <Button data-testid="pay-now-btn" onClick={handleCheckout} disabled={processing} className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                    {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> Redirecting...</> : <><Lock size={14} className="mr-2" /> Pay {pricing.pricing.symbol}{pricing.pricing.total}</>}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center flex items-center justify-center gap-1"><Lock size={10} /> Secure payment via Stripe</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default EnrollmentPage;
