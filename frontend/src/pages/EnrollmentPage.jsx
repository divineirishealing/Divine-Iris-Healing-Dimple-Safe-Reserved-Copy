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
const RELATIONSHIPS = ["Myself", "Mother", "Father", "Sister", "Brother", "Son", "Daughter", "Spouse", "Husband", "Wife", "Grandmother", "Grandfather", "Grandson", "Granddaughter", "Friend", "Colleague", "Relative", "Other"];

const REFERRAL_SOURCES = ["Instagram", "Facebook", "YouTube", "Google Search", "Friend / Family", "WhatsApp", "Other"];

const emptyParticipant = () => ({
  name: '', relationship: '', age: '', gender: '',
  country: 'AE', attendance_mode: 'online', notify: true, email: '', phone: '', whatsapp: '',
  phone_code: '+971', wa_code: '+971',
  is_first_time: true, referral_source: '',
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

const ParticipantRow = ({ index, data, onChange, onRemove, canRemove, showReferral = true, enabledModes = {} }) => {
  const update = (field, value) => {
    const updated = { ...data, [field]: value };
    // When switching to online, force notify on
    if (field === 'attendance_mode' && value === 'online') {
      updated.notify = true;
    }
    onChange(updated);
  };
  const showOnline = enabledModes.enable_online !== false;
  const showOffline = enabledModes.enable_offline !== false;
  const showInPerson = enabledModes.enable_in_person === true;
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
          <select value={data.country} onChange={e => {
            const code = e.target.value;
            const c = COUNTRIES.find(c => c.code === code);
            onChange({ ...data, country: code, phone_code: c ? c.phone : data.phone_code, wa_code: c ? c.phone : data.wa_code });
          }} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select></div>
      </div>
      <div className="flex gap-1 mb-1">
        {showOnline && (
          <button type="button" onClick={() => update('attendance_mode', 'online')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
              data.attendance_mode === 'online' ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-gray-200 text-gray-500'}`}>
            <span className="flex items-center gap-1"><Monitor size={10} /> Online (Zoom)</span>
            <span className="text-[8px] opacity-70">via Zoom</span>
          </button>
        )}
        {showOffline && (
          <button type="button" onClick={() => update('attendance_mode', 'offline')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
              data.attendance_mode === 'offline' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            <span className="flex items-center gap-1"><Wifi size={10} /> Offline</span>
            <span className="text-[8px] opacity-70">Remote, Not In-Person</span>
          </button>
        )}
        {showInPerson && (
          <button type="button" onClick={() => update('attendance_mode', 'in_person')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
              data.attendance_mode === 'in_person' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            <span className="flex items-center gap-1"><Wifi size={10} /> Offline</span>
            <span className="text-[8px] opacity-70">Remote, Not In-Person</span>
          </button>
        )}
      </div>
      {!showInPerson && (
        <p className="text-[8px] text-gray-400 mb-1 italic">All sessions are online via Zoom or remote distance healing — no in-person sessions at this time.</p>
      )}

      {/* Divine Iris membership status */}
      <div className="mb-2 mt-2">
        <label className="text-[9px] text-gray-500 mb-1 block">Are you new to Divine Iris? *</label>
        <div className="flex gap-2">
          <button type="button" data-testid={`p-first-time-${index}`} onClick={() => update('is_first_time', true)}
            className={`flex-1 py-2 rounded-lg border text-[10px] font-medium transition-all ${
              data.is_first_time === true ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            First time joining Divine Iris
          </button>
          <button type="button" data-testid={`p-soul-tribe-${index}`} onClick={() => update('is_first_time', false)}
            className={`flex-1 py-2 rounded-lg border text-[10px] font-medium transition-all ${
              data.is_first_time === false ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            I am Divine Iris Soul Tribe
          </button>
        </div>
      </div>

      {/* Referral source - only shown for first-timers */}
      {data.is_first_time && (
        <div className="mb-2">
          <label className="text-[9px] text-gray-500">How did you hear about us?</label>
          <select data-testid={`p-referral-${index}`} value={data.referral_source || ''} onChange={e => update('referral_source', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            <option value="">Select (optional)</option>{REFERRAL_SOURCES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

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

      {/* Notify - mandatory for online, optional otherwise */}
      {data.attendance_mode === 'online' ? (
        <div className="flex items-center gap-1.5 mb-0.5">
          <Bell size={10} className="text-[#D4AF37]" />
          <span className="text-[10px] text-[#D4AF37] font-medium">Notification will be sent to Participant</span>
        </div>
      ) : (
        <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`p-notify-${index}`}>
          <input type="checkbox" checked={data.notify} onChange={e => update('notify', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
          <span className="text-[10px] text-gray-600 flex items-center gap-1">
            {data.notify ? <Bell size={10} className="text-[#D4AF37]" /> : <BellOff size={10} className="text-gray-400" />} Notify this participant
          </span>
        </label>
      )}
      {data.notify && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Input data-testid={`p-email-${index}`} type="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="Email" className="text-xs h-8" />
          <div className="flex gap-0.5">
            <select value={data.phone_code || '+971'} onChange={e => onChange({ ...data, phone_code: e.target.value, wa_code: e.target.value })}
              className="border rounded-md px-0.5 py-1 text-[10px] w-[60px] bg-white h-8 flex-shrink-0" data-testid={`p-phone-code-${index}`}>
              {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
            </select>
            <Input data-testid={`p-phone-${index}`} type="tel" value={data.phone} onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              const shouldSync = !data.whatsapp || data.whatsapp === data.phone;
              onChange({ ...data, phone: val, ...(shouldSync ? { whatsapp: val } : {}) });
            }} placeholder="Phone (10 digits)" maxLength={10} className="text-xs h-8" />
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
  const { getPrice, getOfferPrice, symbol: detectedSymbol, currency: detectedCurrency, country: detectedCountry } = useCurrency();

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
  const [emailVerified, setEmailVerified] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [discountSettings, setDiscountSettings] = useState({ enable_referral: true });
  const [paymentSettings, setPaymentSettings] = useState({ disclaimer: '', india_links: [], india_exly_link: '', india_bank_details: {}, india_enabled: false });

  // Country → currency mapping for real-time pricing updates
  const CURRENCY_MAP = {
    AE: { currency: 'aed', symbol: 'AED' }, SA: { currency: 'aed', symbol: 'AED' },
    QA: { currency: 'aed', symbol: 'AED' }, KW: { currency: 'aed', symbol: 'AED' },
    OM: { currency: 'aed', symbol: 'AED' }, BH: { currency: 'aed', symbol: 'AED' },
    IN: { currency: 'inr', symbol: 'INR' },
    US: { currency: 'usd', symbol: 'USD' }, GB: { currency: 'usd', symbol: 'USD' },
    AU: { currency: 'usd', symbol: 'USD' }, NZ: { currency: 'usd', symbol: 'USD' },
    CA: { currency: 'usd', symbol: 'USD' }, SG: { currency: 'usd', symbol: 'USD' },
    DE: { currency: 'usd', symbol: 'USD' }, FR: { currency: 'usd', symbol: 'USD' },
  };
  const activeCurrencyInfo = CURRENCY_MAP[bookerCountry] || { currency: detectedCurrency, symbol: detectedSymbol };
  const currency = activeCurrencyInfo.currency;
  const symbol = activeCurrencyInfo.symbol;

  useEffect(() => {
    const ep = type === 'program' ? 'programs' : 'sessions';
    axios.get(`${API}/${ep}/${id}`).then(r => setItem(r.data)).catch(() => navigate('/'));
    axios.get(`${API}/discounts/settings`).then(r => setDiscountSettings(r.data)).catch(() => {});
    axios.get(`${API}/settings`).then(r => {
      const s = r.data;
      setPaymentSettings({
        disclaimer: s.payment_disclaimer || '',
        india_links: (s.india_payment_links || []).filter(l => l.enabled),
        india_alt_discount: s.india_alt_discount_percent || 9,
        india_exly_link: s.india_exly_link || '',
        india_bank_details: s.india_bank_details || {},
        india_enabled: s.india_payment_enabled || false,
      });
    }).catch(() => {});
  }, [id, type, navigate]);

  useEffect(() => {
    if (detectedCountry) { setBookerCountry(detectedCountry); const c = COUNTRIES.find(c => c.code === detectedCountry); if (c) setCountryCode(c.phone); }
  }, [detectedCountry]);
  useEffect(() => { const c = COUNTRIES.find(c => c.code === bookerCountry); if (c) setCountryCode(c.phone); }, [bookerCountry]);

  // Local price getters that respect bookerCountry selection
  const getLocalPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = `price_${currency}`;
    if (tier) return tier[key] || 0;
    return item[key] || 0;
  };
  const getLocalOfferPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) return tier[`offer_${currency}`] || 0;
    if (currency === 'aed') return item.offer_price_aed || 0;
    if (currency === 'inr') return item.offer_price_inr || 0;
    if (currency === 'usd') return item.offer_price_usd || 0;
    return 0;
  };

  const tiers = item?.duration_tiers || [];
  const hasTiers = item?.is_flagship && tiers.length > 0 && selectedTier !== null;
  const tierObj = hasTiers ? tiers[selectedTier] : null;
  const unitPrice = item ? getLocalPrice(item, hasTiers ? selectedTier : null) : 0;
  const offerUnitPrice = item ? getLocalOfferPrice(item, hasTiers ? selectedTier : null) : 0;
  const effectiveUnitPrice = offerUnitPrice > 0 ? offerUnitPrice : unitPrice;
  const pCount = participants.length;
  const subtotalRaw = effectiveUnitPrice * pCount;

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  useEffect(() => {
    if (subtotalRaw <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: 1, num_participants: pCount,
          subtotal: subtotalRaw, email: bookerEmail, currency,
        });
        setAutoDiscounts(res.data);
      } catch { setAutoDiscounts({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 }); }
    };
    const timer = setTimeout(fetchDiscounts, 300);
    return () => clearTimeout(timer);
  }, [subtotalRaw, pCount, bookerEmail, currency]);

  const discount = (() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === 'percentage') return Math.round(subtotalRaw * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  const subtotal = subtotalRaw;
  const totalAutoDiscount = autoDiscounts.total_discount || 0;
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

  const goToReview = () => {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name.trim()) return toast({ title: `Participant ${i + 1}: Enter name`, variant: 'destructive' });
      if (!p.relationship) return toast({ title: `Participant ${i + 1}: Select relationship`, variant: 'destructive' });
      if (!p.age || parseInt(p.age) < 5) return toast({ title: `Participant ${i + 1}: Enter valid age`, variant: 'destructive' });
      if (!p.gender) return toast({ title: `Participant ${i + 1}: Select gender`, variant: 'destructive' });
      if (p.notify || p.attendance_mode === 'online') {
        if (!p.email || !p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
          return toast({ title: `Participant ${i + 1}: Enter a valid email for notification`, variant: 'destructive' });
        if (!p.phone || !p.phone.trim())
          return toast({ title: `Participant ${i + 1}: Enter phone number for notification`, variant: 'destructive' });
      }
      if (p.has_referral && (!p.referred_by_name || !p.referred_by_name.trim()))
        return toast({ title: `Participant ${i + 1}: Enter referrer's name`, variant: 'destructive' });
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
    setLoading(true);
    try {
      const bookerPhone = phone ? `${countryCode}${phone}` : null;
      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        participants: participants.map(p => ({ name: p.name, relationship: p.relationship, age: parseInt(p.age), gender: p.gender, country: p.country, attendance_mode: p.attendance_mode, notify: p.notify, email: p.notify ? p.email : null, phone: p.notify && p.phone ? `${p.phone_code || '+971'}${p.phone}` : null, whatsapp: p.whatsapp ? `${p.wa_code || '+971'}${p.whatsapp}` : null, is_first_time: p.is_first_time || false, referral_source: p.referral_source || '', referred_by_name: p.has_referral ? (p.referred_by_name || '') : '' })),
      });
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      setVpnDetected(enrollRes.data.vpn_detected);
      // Save booker phone to enrollment for pricing cross-validation
      if (bookerPhone) {
        await axios.patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhone }).catch(() => {});
      }
      await axios.post(`${API}/enrollment/${eid}/send-otp`, { email: bookerEmail });
      setOtpSent(true);
      toast({ title: 'Verification code sent to your email!' });
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast({ title: 'Enter 6-digit code', variant: 'destructive' });
    setLoading(true);
    try {
      await axios.post(`${API}/enrollment/${enrollmentId}/verify-otp`, { email: bookerEmail, otp });
      setEmailVerified(true); toast({ title: 'Email verified!' });
      // If total is $0, auto-complete registration (skip payment step)
      if (total <= 0) {
        setProcessing(true);
        try {
          const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
            enrollment_id: enrollmentId, item_type: type, item_id: id, currency,
            origin_url: window.location.origin, promo_code: promoResult?.code || null,
            tier_index: selectedTier,
          });
          toast({ title: 'Registration complete!' });
          navigate(`/payment/success?session_id=${res.data.session_id}`);
          return;
        } catch (err) {
          toast({ title: 'Error completing registration', variant: 'destructive' });
          setProcessing(false);
        }
      }
      setStep(3);
    } catch (err) { toast({ title: err.response?.data?.detail || 'Wrong code', variant: 'destructive' }); }
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
      if (res.data.url === '__FREE_SUCCESS__') {
        // Free enrollment — go directly to success page
        navigate(`/payment/success?session_id=${res.data.session_id}`);
      } else {
        window.location.href = res.data.url;
      }
    } catch (err) { toast({ title: 'Error', description: err.response?.data?.detail || 'Something went wrong', variant: 'destructive' }); setProcessing(false); }
  };

  if (!item) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" size={32} /></div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Lato', 'Helvetica Neue', Arial, sans-serif" }}>
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
                    {autoDiscounts.group_discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600" data-testid="enroll-discount-group">
                        <span>Group Discount ({pCount} people)</span><span>-{symbol} {autoDiscounts.group_discount.toLocaleString()}</span>
                      </div>
                    )}
                    {autoDiscounts.loyalty_discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600" data-testid="enroll-discount-loyalty">
                        <span>Loyalty Discount</span><span>-{symbol} {autoDiscounts.loyalty_discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span className="text-gray-900">Total</span>
                      <span className="text-[#D4AF37]">{total <= 0 ? 'FREE' : `${symbol} ${total.toLocaleString()}`}</span>
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
                        onRemove={() => setParticipants(participants.filter((_, j) => j !== i))} canRemove={participants.length > 1} showReferral={discountSettings.enable_referral}
                        enabledModes={{ enable_online: item?.enable_online, enable_offline: item?.enable_offline, enable_in_person: item?.enable_in_person }} />
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
                        <select data-testid="booker-country" value={bookerCountry} onChange={e => {
                          setBookerCountry(e.target.value);
                          const c = COUNTRIES.find(c => c.code === e.target.value);
                          if (c) setCountryCode(c.phone);
                        }} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
                          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
                      <div><label className="text-[9px] text-gray-500">Phone</label>
                        <div className="flex gap-1">
                          <select value={countryCode} onChange={e => {
                            setCountryCode(e.target.value);
                            const c = COUNTRIES.find(c => c.phone === e.target.value);
                            if (c) setBookerCountry(c.code);
                          }} className="border rounded-md px-1 py-2 text-xs w-20 bg-white">
                            {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}</select>
                          <Input data-testid="enroll-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone number" className="text-sm flex-1" />
                        </div></div>
                    </div>

                    {paymentSettings.disclaimer && (
                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 mb-3" data-testid="payment-disclaimer">
                        <p className="text-[10px] text-amber-800 italic leading-relaxed">{paymentSettings.disclaimer}</p>
                      </div>
                    )}

                    {!otpSent && !emailVerified && (
                      <Button data-testid="send-otp-btn" onClick={submitAndSendOtp} disabled={loading} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mb-3">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Mail size={14} className="mr-2" /> Verify Email & Continue</>}
                      </Button>
                    )}
                    {otpSent && !emailVerified && (
                      <div className="border rounded-lg p-4 bg-gray-50 mb-3">
                        <p className="text-xs text-gray-600 mb-2">Enter the verification code sent to <strong>{bookerEmail}</strong></p>
                        <div className="flex gap-2">
                          <Input data-testid="enroll-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                          <Button data-testid="verify-otp-btn" onClick={verifyOtp} disabled={loading || otp.length !== 6} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                            {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}</Button>
                        </div>
                        <button onClick={() => { setOtpSent(false); setOtp(''); }} className="text-[10px] text-purple-600 mt-2 hover:underline">Resend code / change email</button>
                      </div>
                    )}
                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full"><ChevronLeft size={16} /> Back</Button>
                  </div>
                )}

                {/* Step 3: Pay */}
                {step === 3 && (
                  <div data-testid="step-payment">
                    {total <= 0 ? (
                      /* Free enrollment — simplified confirmation */
                      <>
                        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Confirm Registration</h2>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <p className="text-sm font-semibold text-green-700 mb-1">No payment required</p>
                          <p className="text-xs text-green-600">This enrollment is free. Click below to complete your registration.</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 mb-3 text-xs text-gray-600 space-y-1">
                          <p><strong>Booked by:</strong> {bookerName}</p>
                          <p><strong>Email:</strong> {bookerEmail} <span className="text-green-600">Verified</span></p>
                          {phone && <p><strong>Phone:</strong> {countryCode}{phone}</p>}
                        </div>
                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setStep(2)} className="rounded-full"><ChevronLeft size={16} /></Button>
                          <Button data-testid="pay-now-btn" onClick={handleCheckout} disabled={processing}
                            className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                            {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> Completing...</> : <><Check size={14} className="mr-2" /> Complete Registration</>}
                          </Button>
                        </div>
                      </>
                    ) : (
                      /* Paid enrollment — full payment UI */
                      <>
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Confirm & Pay</h2>
                    <div className="bg-gray-50 rounded-lg p-4 mb-3 text-xs text-gray-600 space-y-1">
                      <p><strong>Booked by:</strong> {bookerName}</p>
                      <p><strong>Email:</strong> {bookerEmail} <span className="text-green-600">Verified</span></p>
                      {phone && <p><strong>Phone:</strong> {countryCode}{phone}</p>}
                    </div>

                    {/* India payment options — only show if enabled in admin */}
                    {bookerCountry === 'IN' && paymentSettings.india_enabled && (
                      <div className="mb-4" data-testid="india-payment-options">
                        {/* Stripe card option first with guidance */}
                        <div className="border-2 border-[#D4AF37] rounded-lg p-4 mb-3 bg-[#D4AF37]/5">
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard size={16} className="text-[#D4AF37]" />
                            <span className="text-sm font-semibold text-gray-900">Pay with Card (Stripe)</span>
                            <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">International</span>
                          </div>
                          <p className="text-[10px] text-gray-600 mb-2">Secure international payment. Your card must be <strong>enabled for international transactions</strong>.</p>
                          <p className="text-[9px] text-gray-400 italic">Contact your bank to enable international payments if not already active.</p>
                        </div>

                        <div className="relative my-3">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                          <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] text-gray-400 uppercase">Or pay via India options</span></div>
                        </div>
                        <button
                          onClick={() => {
                            const params = new URLSearchParams({
                              program: item?.title || '',
                              price: String(subtotal || 0),
                              promo_discount: String(discount || 0),
                              auto_discount: String(totalAutoDiscount || 0),
                            });
                            navigate(`/india-payment/${enrollmentId}?${params.toString()}`);
                          }}
                          className="flex items-center justify-between w-full border rounded-lg p-4 hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                          data-testid="india-alt-payment-option">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <CreditCard size={14} className="text-purple-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">Exly / Bank Transfer</span>
                              <p className="text-[10px] text-green-600 font-medium">Save {paymentSettings.india_alt_discount || 9}% — GPay, Cards, NEFT supported</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600" />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(2)} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="pay-now-btn" onClick={handleCheckout} disabled={processing}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                        {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> {total <= 0 ? 'Registering...' : 'Redirecting...'}</> : total <= 0 ? <><Check size={14} className="mr-2" /> Complete Registration</> : <><Lock size={14} className="mr-2" /> Pay {symbol} {total.toLocaleString()}</>}
                      </Button>
                    </div>

                    {paymentSettings.disclaimer && (
                      <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-lg p-3" data-testid="payment-disclaimer-pay">
                        <p className="text-[10px] text-amber-800 italic leading-relaxed">{paymentSettings.disclaimer}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-3 text-center flex items-center justify-center gap-1"><Lock size={10} /> Secure payment via Stripe</p>
                      </>
                    )}
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
