import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useToast } from '../hooks/use-toast';
import { useCurrency } from '../context/CurrencyContext';
import { resolveImageUrl } from '../lib/imageUtils';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  User, Monitor, Wifi, Mail, Phone, CreditCard, Lock, Plus, Trash2,
  ChevronRight, ChevronLeft, Check, ShieldAlert, ShieldCheck,
  Loader2, Bell, BellOff, Tag, Calendar
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "IN", name: "India", phone: "+91" }, { code: "AE", name: "UAE", phone: "+971" },
  { code: "US", name: "United States", phone: "+1" }, { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "CA", name: "Canada", phone: "+1" }, { code: "AU", name: "Australia", phone: "+61" },
  { code: "SG", name: "Singapore", phone: "+65" }, { code: "DE", name: "Germany", phone: "+49" },
  { code: "FR", name: "France", phone: "+33" }, { code: "SA", name: "Saudi Arabia", phone: "+966" },
  { code: "QA", name: "Qatar", phone: "+974" }, { code: "PK", name: "Pakistan", phone: "+92" },
  { code: "BD", name: "Bangladesh", phone: "+880" }, { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "MY", name: "Malaysia", phone: "+60" }, { code: "JP", name: "Japan", phone: "+81" },
  { code: "ZA", name: "South Africa", phone: "+27" }, { code: "NP", name: "Nepal", phone: "+977" },
  { code: "KW", name: "Kuwait", phone: "+965" }, { code: "OM", name: "Oman", phone: "+968" },
  { code: "BH", name: "Bahrain", phone: "+973" }, { code: "PH", name: "Philippines", phone: "+63" },
  { code: "ID", name: "Indonesia", phone: "+62" }, { code: "TH", name: "Thailand", phone: "+66" },
  { code: "KE", name: "Kenya", phone: "+254" }, { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "EG", name: "Egypt", phone: "+20" }, { code: "TR", name: "Turkey", phone: "+90" },
  { code: "IT", name: "Italy", phone: "+39" }, { code: "ES", name: "Spain", phone: "+34" },
  { code: "NL", name: "Netherlands", phone: "+31" }, { code: "NZ", name: "New Zealand", phone: "+64" },
].sort((a, b) => a.name.localeCompare(b.name));
const GENDERS = ["Female", "Male", "Non-Binary", "Prefer not to say"];
const RELATIONSHIPS = ["Myself", "Mother", "Father", "Sister", "Brother", "Spouse", "Husband", "Wife", "Friend", "Colleague", "Other"];

const REFERRAL_SOURCES = ["Instagram", "Facebook", "YouTube", "Google Search", "Friend / Family", "WhatsApp", "Returning Client", "Other"];

const emptyParticipant = () => ({
  name: '', relationship: '', age: '', gender: '',
  country: 'AE', attendance_mode: 'online', notify: false, email: '', phone: '', whatsapp: '',
  phone_code: '+971', wa_code: '+971',
  is_first_time: false, referral_source: '',
});

const StepBar = ({ current, steps }) => (
  <div className="flex items-center gap-1 mb-6" data-testid="step-bar">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <div className={`flex items-center gap-1.5 ${i <= current ? 'text-[#D4AF37]' : 'text-gray-300'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            i < current ? 'bg-green-500 text-white' : i === current ? 'bg-[#D4AF37] text-white' : 'bg-gray-200 text-gray-400'
          }`}>{i < current ? <Check size={12} /> : i + 1}</div>
          <span className="text-[10px] font-medium hidden md:inline">{s}</span>
        </div>
        {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < current ? 'bg-green-500' : 'bg-gray-200'}`} />}
      </React.Fragment>
    ))}
  </div>
);

const ParticipantRow = ({ index, data, onChange, onRemove, canRemove, showReferral = true }) => {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="border rounded-lg p-3 mb-2 bg-gray-50" data-testid={`participant-${index}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-[#D4AF37]">Participant {index + 1}</span>
        {canRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[9px] text-gray-500">Name *</label>
          <Input data-testid={`p-name-${index}`} value={data.name} onChange={e => update('name', e.target.value)} placeholder="Full name" className="text-xs h-8" /></div>
        <div><label className="text-[9px] text-gray-500">Relationship *</label>
          <select data-testid={`p-relation-${index}`} value={data.relationship} onChange={e => update('relationship', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            <option value="">Select</option>{RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div><label className="text-[9px] text-gray-500">Age *</label>
          <Input data-testid={`p-age-${index}`} type="number" min="5" max="120" value={data.age} onChange={e => update('age', e.target.value)} placeholder="Age" className="text-xs h-8" /></div>
        <div><label className="text-[9px] text-gray-500">Gender *</label>
          <select data-testid={`p-gender-${index}`} value={data.gender} onChange={e => update('gender', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            <option value="">Select</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select></div>
        <div><label className="text-[9px] text-gray-500">Country</label>
          <select value={data.country} onChange={e => update('country', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select></div>
      </div>
      <div className="flex gap-1 mb-2">
        <button type="button" onClick={() => update('attendance_mode', 'online')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded border text-[10px] transition-all ${
            data.attendance_mode === 'online' ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white border-gray-200 text-gray-500'}`}>
          <Monitor size={10} /> Online
        </button>
        <button type="button" onClick={() => update('attendance_mode', 'offline')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded border text-[10px] transition-all ${
            data.attendance_mode === 'offline' ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white border-gray-200 text-gray-500'}`}>
          <Wifi size={10} /> Remote
        </button>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer mb-1.5" data-testid={`p-first-time-${index}`}>
        <input type="checkbox" checked={data.is_first_time} onChange={e => update('is_first_time', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
        <span className="text-[10px] text-gray-600">First time joining Divine Iris Healing</span>
      </label>
      <div className="mb-2">
        <label className="text-[9px] text-gray-500">How did you hear about us?</label>
        <select data-testid={`p-referral-${index}`} value={data.referral_source || ''} onChange={e => update('referral_source', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
          <option value="">Select (optional)</option>{REFERRAL_SOURCES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {showReferral && (
        <>
          <label className="flex items-center gap-1.5 cursor-pointer mb-1.5" data-testid={`p-referred-toggle-${index}`}>
            <input type="checkbox" checked={data.has_referral || false} onChange={e => update('has_referral', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
            <span className="text-[10px] text-gray-600">Referred by a Divine Iris member</span>
          </label>
          {data.has_referral && (
            <Input data-testid={`p-referred-name-${index}`} type="text" value={data.referred_by_name || ''} onChange={e => update('referred_by_name', e.target.value)} placeholder="Referrer's name" className="text-xs h-8 mb-2" />
          )}
        </>
      )}
      <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`p-notify-${index}`}>
        <input type="checkbox" checked={data.notify} onChange={e => update('notify', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
        <span className="text-[10px] text-gray-600 flex items-center gap-1">
          {data.notify ? <Bell size={10} className="text-[#D4AF37]" /> : <BellOff size={10} className="text-gray-400" />} Notify this participant
        </span>
      </label>
      {data.notify && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Input data-testid={`p-email-${index}`} type="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="Email" className="text-xs h-8" />
          <div className="flex gap-0.5">
            <select value={data.phone_code || '+971'} onChange={e => update('phone_code', e.target.value)}
              className="border rounded-md px-0.5 py-1 text-[10px] w-[60px] bg-white h-8 flex-shrink-0" data-testid={`p-phone-code-${index}`}>
              {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
            </select>
            <Input data-testid={`p-phone-${index}`} type="tel" value={data.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Phone (10 digits)" maxLength={10} className="text-xs h-8" />
          </div>
          <div className="flex gap-0.5">
            <select value={data.wa_code || '+971'} onChange={e => update('wa_code', e.target.value)}
              className="border rounded-md px-0.5 py-1 text-[10px] w-[60px] bg-white h-8 flex-shrink-0" data-testid={`p-wa-code-${index}`}>
              {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
            </select>
            <div className="relative flex-1">
              <Input data-testid={`p-whatsapp-${index}`} type="tel" value={data.whatsapp || ''} onChange={e => update('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="WhatsApp (10 digits)" maxLength={10} className="text-xs h-8 pl-7" />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.67-1.228A11.947 11.947 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.352 0-4.55-.743-6.357-2.012l-.232-.168-3.227.85.862-3.147-.185-.239A9.96 9.96 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function EnrollmentPage() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPrice, getOfferPrice, symbol, currency, country: detectedCountry } = useCurrency();

  const tierParam = searchParams.get('tier');
  const selectedTier = tierParam !== null ? parseInt(tierParam) : null;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(null);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [participants, setParticipants] = useState([emptyParticipant()]);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [bookerCountry, setBookerCountry] = useState(detectedCountry || 'AE');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+971');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [mockOtp, setMockOtp] = useState('');
  const [processing, setProcessing] = useState(false);
  const [discountSettings, setDiscountSettings] = useState({ enable_referral: true });

  useEffect(() => {
    const ep = type === 'program' ? 'programs' : 'sessions';
    axios.get(`${API}/${ep}/${id}`).then(r => setItem(r.data)).catch(() => navigate('/'));
    axios.get(`${API}/discounts/settings`).then(r => setDiscountSettings(r.data)).catch(() => {});
  }, [id, type, navigate]);

  useEffect(() => {
    if (detectedCountry) { setBookerCountry(detectedCountry); const c = COUNTRIES.find(c => c.code === detectedCountry); if (c) setCountryCode(c.phone); }
  }, [detectedCountry]);
  useEffect(() => { const c = COUNTRIES.find(c => c.code === bookerCountry); if (c) setCountryCode(c.phone); }, [bookerCountry]);

  const tiers = item?.duration_tiers || [];
  const hasTiers = item?.is_flagship && tiers.length > 0 && selectedTier !== null;
  const tierObj = hasTiers ? tiers[selectedTier] : null;
  const unitPrice = item ? getPrice(item, hasTiers ? selectedTier : null) : 0;
  const offerUnitPrice = item ? getOfferPrice(item, hasTiers ? selectedTier : null) : 0;
  const effectiveUnitPrice = offerUnitPrice > 0 ? offerUnitPrice : unitPrice;
  const pCount = participants.length;
  const discount = (() => {
    if (!promoResult) return 0;
    const sub = effectiveUnitPrice * pCount;
    if (promoResult.discount_type === 'percentage') return Math.round(sub * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  const subtotal = effectiveUnitPrice * pCount;
  const total = Math.max(0, subtotal - discount);

  const goToReview = () => {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name.trim()) return toast({ title: `Participant ${i + 1}: Enter name`, variant: 'destructive' });
      if (!p.relationship) return toast({ title: `Participant ${i + 1}: Select relationship`, variant: 'destructive' });
      if (!p.age || parseInt(p.age) < 5) return toast({ title: `Participant ${i + 1}: Enter valid age`, variant: 'destructive' });
      if (!p.gender) return toast({ title: `Participant ${i + 1}: Select gender`, variant: 'destructive' });
    }
    setStep(1);
  };

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, { code: promoCode.trim(), program_id: id, currency });
      setPromoResult(res.data); toast({ title: res.data.message });
    } catch (err) { setPromoResult(null); toast({ title: 'Invalid Code', variant: 'destructive' }); }
    finally { setPromoLoading(false); }
  };

  const submitAndSendOtp = async () => {
    if (!bookerName.trim()) return toast({ title: 'Enter name', variant: 'destructive' });
    if (!bookerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookerEmail)) return toast({ title: 'Enter valid email', variant: 'destructive' });
    if (!phone.trim() || phone.length < 7) return toast({ title: 'Enter valid phone', variant: 'destructive' });
    setLoading(true);
    try {
      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        participants: participants.map(p => ({ name: p.name, relationship: p.relationship, age: parseInt(p.age), gender: p.gender, country: p.country, attendance_mode: p.attendance_mode, notify: p.notify, email: p.notify ? p.email : null, phone: p.notify && p.phone ? `${p.phone_code || '+971'}${p.phone}` : null, whatsapp: p.whatsapp ? `${p.wa_code || '+971'}${p.whatsapp}` : null, is_first_time: p.is_first_time || false, referral_source: p.referral_source || '', referred_by_name: p.has_referral ? (p.referred_by_name || '') : '' })),
      });
      setEnrollmentId(enrollRes.data.enrollment_id);
      setVpnDetected(enrollRes.data.vpn_detected);
      const otpRes = await axios.post(`${API}/enrollment/${enrollRes.data.enrollment_id}/send-otp`, { phone, country_code: countryCode });
      setOtpSent(true);
      if (otpRes.data.mock_otp) setMockOtp(otpRes.data.mock_otp);
      toast({ title: 'OTP Sent!' });
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast({ title: 'Enter 6-digit OTP', variant: 'destructive' });
    setLoading(true);
    try {
      await axios.post(`${API}/enrollment/${enrollmentId}/verify-otp`, { phone, country_code: countryCode, otp });
      setPhoneVerified(true); toast({ title: 'Phone verified!' }); setStep(3);
    } catch { toast({ title: 'Wrong OTP', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId, item_type: type, item_id: id, currency,
        origin_url: window.location.origin, promo_code: promoResult?.code || null,
        tier_index: selectedTier,
      });
      window.location.href = res.data.url;
    } catch (err) { toast({ title: 'Payment Error', variant: 'destructive' }); setProcessing(false); }
  };

  if (!item) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" size={32} /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* LEFT: Program Details (fixed on desktop, top on mobile) */}
            <div className="lg:w-2/5">
              <div className="lg:sticky lg:top-24 bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="relative h-48 overflow-hidden">
                  <img src={resolveImageUrl(item.image)} alt={item.title} className="w-full h-full object-cover"
                    onError={e => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=300&fit=crop'; }} />
                  {item.session_mode && (
                    <span className={`absolute top-3 left-3 text-[10px] px-2.5 py-1 rounded-full font-medium ${
                      item.session_mode === 'online' ? 'bg-blue-500/90 text-white' : 'bg-purple-500/90 text-white'}`}>
                      {item.session_mode === 'online' ? 'Online' : 'Remote'}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[#D4AF37] text-[10px] tracking-wider uppercase mb-1">{item.category}</p>
                  <h2 data-testid="enrollment-title" className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h2>
                  {tierObj && (
                    <span className="inline-block bg-[#D4AF37]/10 text-[#D4AF37] text-xs px-3 py-1 rounded-full font-medium mb-3">{tierObj.label}</span>
                  )}
                  <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3">{item.description}</p>
                  {item.start_date && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Calendar size={12} /> Starts: {item.start_date}</div>
                  )}

                  {/* Price summary */}
                  <div className="border-t pt-4 mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Per person</span>
                      <span>{offerUnitPrice > 0 ? <><span className="text-[#D4AF37] font-bold">{symbol} {offerUnitPrice.toLocaleString()}</span> <span className="line-through text-gray-400">{symbol} {unitPrice.toLocaleString()}</span></> : <span className="font-bold">{symbol} {unitPrice.toLocaleString()}</span>}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Participants</span><span>{pCount}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Promo</span><span>-{symbol} {discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span className="text-gray-900">Total</span>
                      <span className="text-[#D4AF37]">{symbol} {total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Registration Form (scrollable) */}
            <div className="lg:w-3/5">
              <StepBar current={step} steps={['Participants', 'Review', 'Billing', 'Pay']} />

              <div className="bg-white rounded-xl border shadow-sm p-5 md:p-6">
                {/* Step 0: Participants */}
                {step === 0 && (
                  <div data-testid="step-participants">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><User size={16} className="text-[#D4AF37]" /> Who is participating?</h2>
                    {participants.map((p, i) => (
                      <ParticipantRow key={i} index={i} data={p} onChange={d => { const u = [...participants]; u[i] = d; setParticipants(u); }}
                        onRemove={() => setParticipants(participants.filter((_, j) => j !== i))} canRemove={participants.length > 1} showReferral={discountSettings.enable_referral} />
                    ))}
                    <button data-testid="add-participant-btn" onClick={() => setParticipants([...participants, emptyParticipant()])}
                      className="w-full border-2 border-dashed border-[#D4AF37]/40 rounded-lg py-2.5 flex items-center justify-center gap-1 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors mb-4">
                      <Plus size={14} /> Add Participant
                    </button>
                    <Button data-testid="step0-next" onClick={goToReview} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                      Review Cart <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                )}

                {/* Step 1: Review + Promo */}
                {step === 1 && (
                  <div data-testid="step-review">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Tag size={16} className="text-[#D4AF37]" /> Review & Promo</h2>
                    <div className="bg-gray-50 rounded-lg p-4 mb-3 border">
                      {participants.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600 py-1.5 border-b last:border-0">
                          <span>{p.name} <span className="text-gray-400">({p.relationship})</span></span>
                          <span>{symbol} {effectiveUnitPrice.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mb-4">
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Promo Code</label>
                      <div className="flex gap-2">
                        <Input data-testid="promo-code-input" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter code" className="text-sm flex-1" disabled={!!promoResult} />
                        {promoResult ? <Button size="sm" variant="outline" onClick={() => { setPromoResult(null); setPromoCode(''); }}>Remove</Button>
                          : <Button size="sm" onClick={validatePromo} disabled={promoLoading || !promoCode.trim()} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs">
                              {promoLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
                            </Button>}
                      </div>
                      {promoResult && <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1"><Check size={12} className="text-green-600" /><span className="text-xs text-green-700">Saving {symbol} {discount.toLocaleString()}</span></div>}
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(0)} className="rounded-full"><ChevronLeft size={16} /> Back</Button>
                      <Button data-testid="step1-next" onClick={() => setStep(2)} className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">Billing <ChevronRight size={16} className="ml-1" /></Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Billing + OTP */}
                {step === 2 && (
                  <div data-testid="step-billing">
                    {vpnDetected && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <ShieldAlert size={14} className="text-red-500 mt-0.5" /><p className="text-xs text-red-700">VPN detected. Regional pricing may not apply.</p>
                      </div>
                    )}
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><CreditCard size={16} className="text-[#D4AF37]" /> Billing Details</h2>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="text-[9px] text-gray-500">Name *</label>
                        <Input data-testid="booker-name" value={bookerName} onChange={e => setBookerName(e.target.value)} placeholder="Your name" className="text-sm" /></div>
                      <div><label className="text-[9px] text-gray-500">Email *</label>
                        <Input data-testid="booker-email" type="email" value={bookerEmail} onChange={e => setBookerEmail(e.target.value)} placeholder="email@example.com" className="text-sm" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><label className="text-[9px] text-gray-500">Country *</label>
                        <select data-testid="booker-country" value={bookerCountry} onChange={e => setBookerCountry(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
                          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
                      <div><label className="text-[9px] text-gray-500">Phone *</label>
                        <div className="flex gap-1">
                          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="border rounded-md px-1 py-2 text-xs w-20 bg-white">
                            {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}</select>
                          <Input data-testid="enroll-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone" className="text-sm flex-1" disabled={otpSent} />
                        </div></div>
                    </div>

                    {!otpSent && !phoneVerified && (
                      <Button data-testid="send-otp-btn" onClick={submitAndSendOtp} disabled={loading} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mb-3">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Phone size={14} className="mr-2" /> Verify & Continue</>}
                      </Button>
                    )}
                    {otpSent && !phoneVerified && (
                      <div className="border rounded-lg p-4 bg-gray-50 mb-3">
                        <p className="text-xs text-gray-600 mb-2">Enter OTP sent to {countryCode}{phone}</p>
                        <div className="flex gap-2">
                          <Input data-testid="enroll-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="OTP" maxLength={6} className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                          <Button data-testid="verify-otp-btn" onClick={verifyOtp} disabled={loading || otp.length !== 6} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                            {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}</Button>
                        </div>
                        {mockOtp && <p data-testid="mock-otp-display" className="text-xs text-orange-500 mt-2 bg-orange-50 p-2 rounded text-center">Test OTP: <strong className="font-mono">{mockOtp}</strong></p>}
                      </div>
                    )}
                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full"><ChevronLeft size={16} /> Back</Button>
                  </div>
                )}

                {/* Step 3: Pay */}
                {step === 3 && (
                  <div data-testid="step-payment">
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Confirm & Pay</h2>
                    <div className="bg-gray-50 rounded-lg p-4 mb-3 text-xs text-gray-600 space-y-1">
                      <p><strong>Booked by:</strong> {bookerName}</p>
                      <p><strong>Email:</strong> {bookerEmail}</p>
                      <p><strong>Phone:</strong> {countryCode}{phone} <span className="text-green-600">Verified</span></p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(2)} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="pay-now-btn" onClick={handleCheckout} disabled={processing || total <= 0}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                        {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> Redirecting...</> : <><Lock size={14} className="mr-2" /> Pay {symbol} {total.toLocaleString()}</>}
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 text-center flex items-center justify-center gap-1"><Lock size={10} /> Secure payment via Stripe</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default EnrollmentPage;
