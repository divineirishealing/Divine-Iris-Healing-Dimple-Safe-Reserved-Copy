import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useToast } from '../hooks/use-toast';
import { useCurrency } from '../context/CurrencyContext';
import { useCart } from '../context/CartContext';
import { resolveImageUrl } from '../lib/imageUtils';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  User, Monitor, Wifi, Mail, Phone, CreditCard, Lock, Plus, Trash2,
  ChevronRight, ChevronLeft, Check, ShieldAlert, ShieldCheck,
  Loader2, Bell, BellOff, Tag, Calendar, FileText, Quote, Clock, Gift, Star
} from 'lucide-react';
import StarField from '../components/ui/StarField';

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

const REFERRAL_SOURCES = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Spotify", "Google Search", "Friend / Family", "WhatsApp", "Other"];

const emptyParticipant = () => ({
  name: '', relationship: '', age: '', gender: '',
  country: '', city: '', state: '', attendance_mode: 'online', notify: true, email: '', phone: '', whatsapp: '',
  phone_code: '', wa_code: '',
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

const ParticipantRow = ({ index, data, onChange, onRemove, canRemove, showReferral = true, enabledModes = {}, onCopyFromFirst }) => {
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
        <div className="flex items-center gap-2">
          {onCopyFromFirst && (
            <button type="button" onClick={onCopyFromFirst} data-testid={`copy-from-p1-${index}`}
              className="text-[9px] px-2 py-1 rounded-md bg-[#5D3FD3]/10 text-[#5D3FD3] hover:bg-[#5D3FD3]/20 font-medium transition-colors">
              Same as Participant 1
            </button>
          )}
          {canRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[9px] text-gray-500">Name *</label>
          <Input data-testid={`p-name-${index}`} name="name" autoComplete="name" value={data.name} onChange={e => update('name', e.target.value)} placeholder="Full name" className="text-xs h-8" /></div>
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
        <div><label className="text-[9px] text-gray-500">Country *</label>
          <select value={data.country} onChange={e => {
            const code = e.target.value;
            const c = COUNTRIES.find(c => c.code === code);
            onChange({ ...data, country: code, city: '', state: '', phone_code: c ? c.phone : '', wa_code: c ? c.phone : '' });
          }} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
            <option value="">Select country</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[9px] text-gray-500">City *</label>
          <Input data-testid={`p-city-${index}`} value={data.city || ''} onChange={e => update('city', e.target.value)} placeholder="City" className="text-xs h-8" /></div>
        <div><label className="text-[9px] text-gray-500">State *</label>
          <Input data-testid={`p-state-${index}`} value={data.state || ''} onChange={e => update('state', e.target.value)} placeholder="State / Province" className="text-xs h-8" /></div>
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
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-gray-500">How did you hear about us?</label>
            <select data-testid={`p-referral-${index}`} value={data.referral_source || ''} onChange={e => update('referral_source', e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
              <option value="">Select (optional)</option>{REFERRAL_SOURCES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {data.referral_source === 'Friend / Family' && (
            <div>
              <label className="text-[9px] text-gray-500">Referred by</label>
              <Input data-testid={`p-referrer-name-${index}`} type="text" value={data.referred_by_name || ''} onChange={e => update('referred_by_name', e.target.value)} placeholder="Referrer's name" className="text-xs h-8" />
            </div>
          )}
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
          <Input data-testid={`p-email-${index}`} type="email" name="email" autoComplete="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="Email" className="text-xs h-8" />
          <div className="flex gap-0.5">
            <span className="border rounded-md px-1.5 py-1 text-[10px] w-[60px] bg-gray-50 h-8 flex-shrink-0 flex items-center justify-center text-gray-600" data-testid={`p-phone-code-${index}`}>
              {data.phone_code || '—'}
            </span>
            <Input data-testid={`p-phone-${index}`} type="tel" name="phone" autoComplete="tel-national" value={data.phone} onChange={e => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              const shouldSync = !data.whatsapp || data.whatsapp === data.phone;
              onChange({ ...data, phone: val, ...(shouldSync ? { whatsapp: val } : {}) });
            }} placeholder="Phone (10 digits)" maxLength={10} className="text-xs h-8" />
          </div>
          <div className="flex gap-0.5">
            <span className="border rounded-md px-1.5 py-1 text-[10px] w-[60px] bg-gray-50 h-8 flex-shrink-0 flex items-center justify-center text-gray-600" data-testid={`p-wa-code-${index}`}>
              {data.wa_code || '—'}
            </span>
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

/* ─── URGENCY TESTIMONIAL STRIP ─── */
const UrgencyStrip = ({ quotes }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % quotes.length);
        setVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(cycle);
  }, [quotes]);

  if (!quotes.length) return null;
  const q = quotes[index];

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border-2 border-[#D4AF37]/40 px-5 py-4 relative" data-testid="urgency-strip"
      style={{ background: 'linear-gradient(135deg, #2D1B69 0%, #4c1d95 40%, #5D3FD3 100%)' }}>
      {/* Decorative gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
      <div
        className="flex items-center gap-4 transition-all duration-400 ease-in-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}
      >
        <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
          <Quote size={14} className="text-[#D4AF37]" />
        </div>
        <p className="text-sm text-white/90 italic flex-1 leading-relaxed font-medium">
          "{q.text || q}"
        </p>
        {(q.name || q.author) && (
          <span className="text-xs text-[#D4AF37] font-bold whitespace-nowrap">
            — {q.name || q.author}
          </span>
        )}
      </div>
    </div>
  );
};

function EnrollmentPage() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getPrice, getOfferPrice, symbol: rawSymbol, baseCurrency, baseSymbol, displayCurrency, displaySymbol, isPrimary, toDisplay, country: detectedCountry } = useCurrency();
  const currency = baseCurrency;

  const tierParam = searchParams.get('tier');
  const [selectedTier, setSelectedTier] = useState(tierParam !== null ? parseInt(tierParam) : null);
  const resumeId = searchParams.get('resume');
  const inrToken = searchParams.get('inr_token');
  const [inrOverride, setInrOverride] = useState(false);

  // Country is NOT auto-filled — user must select manually

  const [step, setStep] = useState(0); // 0=Participants+Promo+OTP, 1=Pay
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState(null);

  // Default to tier 0 if program has tiers and no tier selected
  useEffect(() => {
    if (item?.is_flagship && item?.duration_tiers?.length > 0 && selectedTier === null) {
      setSelectedTier(0);
    }
  }, [item]);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [participants, setParticipants] = useState([emptyParticipant()]);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [discountSettings, setDiscountSettings] = useState({ enable_referral: true });
  const [paymentSettings, setPaymentSettings] = useState({ disclaimer: '', disclaimer_enabled: true, disclaimer_style: {}, india_links: [], india_exly_link: '', india_bank_details: {}, india_enabled: false, manual_form_enabled: true });
  const [sessionTestimonials, setSessionTestimonials] = useState([]);
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const [crossSellRules, setCrossSellRules] = useState([]);

  // Auto-derive booker from first participant
  const firstP = participants[0] || {};
  const bookerName = firstP.name || '';
  const bookerEmail = firstP.email || '';
  const bookerCountry = firstP.country || '';
  const phone = firstP.phone || '';
  const countryCode = firstP.phone_code || '';

  useEffect(() => {
    const ep = type === 'program' ? 'programs' : 'sessions';
    axios.get(`${API}/${ep}/${id}`).then(r => setItem(r.data)).catch(() => navigate('/'));
    axios.get(`${API}/discounts/settings`).then(r => {
      setDiscountSettings(r.data);
      if (r.data?.enable_cross_sell && r.data?.cross_sell_rules?.length > 0) {
        setCrossSellRules(r.data.cross_sell_rules.filter(r => r.enabled !== false));
      }
    }).catch(() => {});
    axios.get(`${API}/settings`).then(r => {
      const s = r.data;
      setPaymentSettings({
        disclaimer: s.payment_disclaimer || '',
        disclaimer_enabled: s.payment_disclaimer_enabled !== false,
        disclaimer_style: s.payment_disclaimer_style || {},
        india_links: (s.india_payment_links || []).filter(l => l.enabled),
        india_alt_discount: s.india_alt_discount_percent || 9,
        india_exly_link: s.india_exly_link || '',
        india_bank_details: s.india_bank_details || {},
        india_enabled: s.india_payment_enabled || false,
        manual_form_enabled: s.manual_form_enabled !== false,
      });
      setUrgencyQuotes(s.enrollment_urgency_quotes || []);
    }).catch(() => {});
    if (type === 'session') {
      axios.get(`${API}/session-extras/testimonials?session_id=${id}`).then(r => setSessionTestimonials(r.data || [])).catch(() => {});
    }
  }, [id, type, navigate]);

  // Resume enrollment from cancel/back — restore all filled info and jump to payment step
  useEffect(() => {
    if (!resumeId) return;
    axios.get(`${API}/enrollment/${resumeId}`).then(r => {
      const e = r.data;
      setEnrollmentId(resumeId);
      if (e.participants && e.participants.length > 0) {
        setParticipants(e.participants.map(p => {
          const phoneStr = p.phone || '';
          const waStr = p.whatsapp || '';
          const matchedCountry = COUNTRIES.find(c => phoneStr.startsWith(c.phone));
          const pCode = matchedCountry ? matchedCountry.phone : '';
          const rawPhone = matchedCountry ? phoneStr.slice(matchedCountry.phone.length) : phoneStr;
          const rawWa = matchedCountry ? waStr.slice(matchedCountry.phone.length) : waStr;
          return {
            name: p.name || '', relationship: p.relationship || '', age: String(p.age || ''), gender: p.gender || '',
            country: p.country || '', city: p.city || '', state: p.state || '', attendance_mode: p.attendance_mode || 'online',
            notify: p.notify !== false, email: p.email || '', phone: rawPhone,
            whatsapp: rawWa,
            phone_code: pCode, wa_code: pCode,
            is_first_time: p.is_first_time !== false, referral_source: p.referral_source || '',
            has_referral: !!p.referred_by_name, referred_by_name: p.referred_by_name || '',
          };
        }));
      }
      setEmailVerified(true);
      setOtpSent(true);
      setStep(1);
      toast({ title: "Welcome back", description: "Your information is saved — continue to payment.", variant: "default" });
    }).catch(() => {});
  }, [resumeId]);

  // Validate INR invite token
  useEffect(() => {
    if (!inrToken) return;
    axios.post(`${API}/enrollment/inr-override/validate-token`, { token: inrToken })
      .then(() => { setInrOverride(true); toast({ title: 'INR pricing activated!' }); })
      .catch(() => {});
  }, [inrToken]);

  // Local price getters — use INR when inrOverride active
  const priceCurrency = inrOverride ? 'inr' : currency;
  const priceSymbol = inrOverride ? '₹' : rawSymbol;
  const symbol = priceSymbol; // Use INR symbol when override active
  const getLocalPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    const key = `price_${priceCurrency}`;
    if (tier) return tier[key] || 0;
    return item[key] || 0;
  };
  const getLocalOfferPrice = (item, tierIndex = null) => {
    if (!item) return 0;
    const tiers = item.duration_tiers || [];
    const hasTiers = item.is_flagship && tiers.length > 0;
    const tier = hasTiers && tierIndex !== null ? tiers[tierIndex] : null;
    if (tier) return tier[`offer_price_${priceCurrency}`] || tier[`offer_${priceCurrency}`] || 0;
    if (priceCurrency === 'aed') return item.offer_price_aed || 0;
    if (priceCurrency === 'inr') return item.offer_price_inr || 0;
    if (priceCurrency === 'usd') return item.offer_price_usd || 0;
    return 0;
  };

  const tiers = item?.duration_tiers || [];
  const hasTiers = item?.is_flagship && tiers.length > 0 && selectedTier !== null;
  const tierObj = hasTiers ? tiers[selectedTier] : null;

  // Tier-aware display values for the left card
  const displayStartDate = tierObj?.start_date || item?.start_date || '';
  const displayEndDate = tierObj?.end_date || item?.end_date || '';
  const displayDuration = tierObj?.duration || item?.duration || '';

  // Price getters — use INR directly when inrOverride is active
  const effectiveCurrency = inrOverride ? 'inr' : currency;
  const effectiveSymbol = inrOverride ? '₹' : symbol;

  const unitPrice = item ? (inrOverride ? getLocalPrice(item, hasTiers ? selectedTier : null) : toDisplay(getLocalPrice(item, hasTiers ? selectedTier : null))) : 0;
  const offerUnitPrice = item ? (inrOverride ? getLocalOfferPrice(item, hasTiers ? selectedTier : null) : toDisplay(getLocalOfferPrice(item, hasTiers ? selectedTier : null))) : 0;
  const effectiveUnitPrice = offerUnitPrice > 0 ? offerUnitPrice : unitPrice;

  // Cross-sell: check if "buy" program is in cart → this program gets discount
  const { items: cartItems } = useCart();
  const crossSellDiscount = (() => {
    if (!crossSellRules.length || effectiveUnitPrice <= 0) return null;
    for (const rule of crossSellRules) {
      const targets = rule.targets || (rule.get_program_id ? [{ program_id: rule.get_program_id, discount_value: rule.discount_value, discount_type: rule.discount_type }] : []);
      const matchTarget = targets.find(t => String(t.program_id) === String(id));
      if (!matchTarget) continue;
      // Check buy program + tier in cart
      const buyTier = rule.buy_tier;
      const buyInCart = (buyTier !== '' && buyTier !== undefined && buyTier !== null)
        ? cartItems.some(i => String(i.programId) === String(rule.buy_program_id) && String(i.tierIndex) === String(buyTier))
        : cartItems.some(i => String(i.programId) === String(rule.buy_program_id));
      if (buyInCart) {
        const disc = matchTarget.discount_type === 'percentage'
          ? Math.round(effectiveUnitPrice * (matchTarget.discount_value || 0) / 100)
          : (matchTarget.discount_value || 0);
        return { amount: disc, label: rule.label, value: matchTarget.discount_value, type: matchTarget.discount_type };
      }
    }
    return null;
  })();
  const finalUnitPrice = crossSellDiscount ? Math.max(0, effectiveUnitPrice - crossSellDiscount.amount) : effectiveUnitPrice;

  // VIP/Special offer check
  const [vipOffer, setVipOffer] = useState(null);
  useEffect(() => {
    const email = participants[0]?.email || '';
    const phone = participants[0]?.phone || '';
    if (!email && !phone) { setVipOffer(null); return; }
    const timer = setTimeout(() => {
      axios.post(`${API}/enrollment/check-vip-offer`, { email, phone, program_id: id })
        .then(r => { if (r.data?.matched) setVipOffer(r.data); else setVipOffer(null); })
        .catch(() => setVipOffer(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [participants[0]?.email, participants[0]?.phone, id]);

  const vipDiscount = vipOffer ? (
    vipOffer.discount_type === 'fixed' ? (vipOffer.discount_amount || 0) : Math.round(finalUnitPrice * (vipOffer.discount_pct || 0) / 100)
  ) : 0;

  // NO STACKING: best single discount wins
  // Priority: VIP > CrossSell > Promo (auto-discounts handled at checkout)
  const bestDiscount = vipDiscount > 0 ? { type: 'vip', amount: vipDiscount } :
    crossSellDiscount?.amount > 0 ? { type: 'crosssell', amount: crossSellDiscount.amount } : { type: 'none', amount: 0 };
  const afterDiscountPrice = Math.max(0, finalUnitPrice - bestDiscount.amount);

  const pCount = participants.length;
  const subtotalRaw = afterDiscountPrice * pCount;

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  useEffect(() => {
    if (subtotalRaw <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: 1 + cartItems.length, num_participants: pCount,
          subtotal: subtotalRaw, email: bookerEmail, currency,
          program_ids: [id, ...cartItems.map(i => i.programId)],
          cart_items: [{ program_id: id, tier_index: selectedTier }, ...cartItems.map(i => ({ program_id: i.programId, tier_index: i.tierIndex }))],
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
  // Exclude cross_sell from auto discounts — it's already applied per-program via finalUnitPrice
  const totalAutoDiscount = (autoDiscounts.group_discount || 0) + (autoDiscounts.combo_discount || 0) + (autoDiscounts.loyalty_discount || 0);
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

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
    // Validate participants first
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name.trim()) return toast({ title: `Participant ${i + 1}: Enter name`, variant: 'destructive' });
      if (!p.relationship) return toast({ title: `Participant ${i + 1}: Select relationship`, variant: 'destructive' });
      if (!p.age || parseInt(p.age) < 5) return toast({ title: `Participant ${i + 1}: Enter valid age`, variant: 'destructive' });
      if (!p.gender) return toast({ title: `Participant ${i + 1}: Select gender`, variant: 'destructive' });
      if (!p.country) return toast({ title: `Participant ${i + 1}: Select country`, variant: 'destructive' });
      if (!p.city || !p.city.trim()) return toast({ title: `Participant ${i + 1}: Enter city`, variant: 'destructive' });
      if (!p.state || !p.state.trim()) return toast({ title: `Participant ${i + 1}: Enter state`, variant: 'destructive' });
      if (p.notify || p.attendance_mode === 'online') {
        if (!p.email || !p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
          return toast({ title: `Participant ${i + 1}: Enter a valid email`, variant: 'destructive' });
        if (!p.phone || !p.phone.trim())
          return toast({ title: `Participant ${i + 1}: Enter phone number`, variant: 'destructive' });
      }
    }
    if (!bookerEmail) return toast({ title: 'Participant email is required for verification', variant: 'destructive' });

    setLoading(true);
    try {
      const bookerPhone = phone ? `${countryCode}${phone}` : null;
      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        participants: participants.map(p => ({ name: p.name, relationship: p.relationship, age: parseInt(p.age), gender: p.gender, country: p.country, city: p.city, state: p.state, attendance_mode: p.attendance_mode, notify: p.notify, email: p.notify ? p.email : null, phone: p.notify && p.phone ? `${p.phone_code || ''}${p.phone}` : null, whatsapp: p.whatsapp ? `${p.wa_code || ''}${p.whatsapp}` : null, is_first_time: p.is_first_time || false, referral_source: p.referral_source || '', referred_by_name: p.has_referral ? (p.referred_by_name || '') : '' })),
      });
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      setVpnDetected(enrollRes.data.vpn_detected);
      if (bookerPhone) {
        await axios.patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhone }).catch(() => {});
      }
      await axios.post(`${API}/enrollment/${eid}/send-otp`, { email: bookerEmail });
      setOtpSent(true);
      // Apply INR override if token present
      if (inrToken) {
        await axios.post(`${API}/enrollment/inr-override/apply-to-enrollment`, { enrollment_id: eid, method: 'token', value: inrToken }).catch(() => {});
      }
      // Check whitelist match
      try {
        const settingsRes = await axios.get(`${API}/settings`);
        const wl = (settingsRes.data?.inr_whitelist_emails || []).map(e => e.toLowerCase().trim());
        if (wl.includes(bookerEmail.toLowerCase().trim())) {
          await axios.post(`${API}/enrollment/inr-override/apply-to-enrollment`, { enrollment_id: eid, method: 'whitelist', value: bookerEmail }).catch(() => {});
        }
      } catch {}
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
            browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
          });
          toast({ title: 'Registration complete!' });
          navigate(`/payment/success?session_id=${res.data.session_id}`);
          return;
        } catch (err) {
          toast({ title: 'Error completing registration', variant: 'destructive' });
          setProcessing(false);
        }
      }
      setStep(1);
    } catch (err) { toast({ title: err.response?.data?.detail || 'Wrong code', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId, item_type: type, item_id: id, currency: priceCurrency,
        display_currency: priceCurrency, display_rate: isPrimary ? 1 : undefined,
        origin_url: window.location.origin, promo_code: promoResult?.code || null,
        tier_index: selectedTier,
        browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
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

            {/* LEFT: Program/Session Details (fixed on desktop, top on mobile) */}
            <div className="lg:w-2/5">
              <div className="lg:sticky lg:top-24 bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Purple header for sessions, image for programs */}
                {type === 'session' ? (
                  <div className="relative h-48 overflow-hidden" style={{ background: 'linear-gradient(160deg, #1a0e2e 0%, #2a1252 20%, #3b1a6e 40%, #4c1d95 60%, #5b21b6 80%, #4c1d95 100%)' }}>
                    <StarField count={120} color="#D4AF37" />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.3), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(212, 175, 55, 0.08), transparent 50%)' }} />
                    <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
                      <p className="text-[10px] text-[#D4AF37] tracking-[0.3em] uppercase font-medium mb-2">{item.category || 'Personal Session'}</p>
                      <h2 data-testid="enrollment-title" className="text-lg font-semibold text-white mb-2" style={{ fontFamily: "'Cinzel', serif", fontVariant: 'small-caps', letterSpacing: '0.05em' }}>{item.title}</h2>
                      <div className="w-12 h-0.5 bg-[#D4AF37]" />
                    </div>
                  </div>
                ) : (
                  <div className="relative h-48 overflow-hidden">
                    <img src={resolveImageUrl(item.image)} alt={item.title} className="w-full h-full object-cover"
                      onError={e => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=300&fit=crop'; }} />
                    {/* Mode badges - top left */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                      {item.enable_online !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit">Online (Zoom)</span>}
                      {item.enable_offline !== false && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">Offline (Remote)</span>}
                      {item.enable_in_person && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit">In-Person</span>}
                    </div>
                    {/* Dates & timing - top right */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                      {displayStartDate && item.show_start_date_on_card !== false && (
                        <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Calendar size={10} /> Starts: {displayStartDate}
                        </span>
                      )}
                      {displayEndDate && item.show_end_date_on_card !== false && (
                        <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Calendar size={10} /> Ends: {displayEndDate}
                        </span>
                      )}
                      {item.timing && item.show_timing_on_card !== false && (
                        <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock size={10} /> {item.timing} {item.time_zone || ''}
                        </span>
                      )}
                      {displayDuration && item.show_duration_on_card !== false && (
                        <span className="bg-[#D4AF37] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">{displayDuration}</span>
                      )}
                    </div>
                    {/* Exclusive offer badge - bottom */}
                    {item.exclusive_offer_enabled && item.exclusive_offer_text && (
                      <div className="absolute bottom-3 left-3">
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg tracking-wide uppercase animate-pulse">
                          {item.exclusive_offer_text}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-5">
                  {type !== 'session' && <p className="text-[#D4AF37] text-[10px] tracking-wider uppercase mb-1">{item.category}</p>}
                  {type !== 'session' && (
                    <div className="flex items-start gap-2 mb-2">
                      <h2 data-testid="enrollment-title" className="text-lg font-semibold text-gray-900">{item.title}</h2>
                      {item.highlight_label && (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase px-2 py-1 rounded-full whitespace-nowrap"
                          style={
                            item.highlight_style === 'ribbon'
                              ? { background: '#1a1a1a', color: '#D4AF37', borderLeft: '2px solid #D4AF37', borderRadius: '4px' }
                              : item.highlight_style === 'glow'
                              ? { background: 'linear-gradient(135deg, #fff8e7, #fff3d0)', color: '#b8860b', border: '1px solid rgba(212,175,55,0.33)', boxShadow: '0 0 10px rgba(212,175,55,0.2)' }
                              : { background: 'linear-gradient(135deg, #D4AF37, #f5d77a, #D4AF37)', color: '#3d2200', boxShadow: '0 2px 6px rgba(212,175,55,0.25)' }
                          }>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill={item.highlight_style === 'glow' ? 'none' : '#3d2200'} stroke={item.highlight_style === 'glow' ? '#b8860b' : 'none'} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {item.highlight_label}
                        </span>
                      )}
                    </div>
                  )}
                  {tierObj && (
                    <span className="inline-block bg-[#D4AF37]/10 text-[#D4AF37] text-xs px-3 py-1 rounded-full font-medium mb-3">{tierObj.label}</span>
                  )}
                  <p className="text-gray-500 text-xs leading-relaxed mb-4 line-clamp-3">{item.description}</p>

                  {/* Early bird / offer countdown */}
                  {offerUnitPrice > 0 && (item.deadline_date || item.start_date) && (() => {
                    const dl = new Date(item.deadline_date || item.start_date);
                    if (isNaN(dl.getTime()) || dl <= new Date()) return null;
                    const diff = dl - Date.now();
                    const days = Math.floor(diff / 86400000);
                    const hours = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    return (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3 animate-pulse" data-testid="enroll-early-bird">
                        <Bell size={14} className="text-red-500 flex-shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold text-red-600">{item.offer_text || 'Early Bird'}</span>
                          <span className="text-red-500 ml-1.5">ends in {days}d {hours}h {mins}m</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Price summary */}
                  <div className="border-t pt-4 mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Per person</span>
                      <span>
                        {crossSellDiscount ? (
                          <><span className="text-green-600 font-bold">{symbol} {finalUnitPrice.toLocaleString()}</span> <span className="line-through text-gray-400">{symbol} {effectiveUnitPrice.toLocaleString()}</span></>
                        ) : offerUnitPrice > 0 ? (
                          <><span className="text-[#D4AF37] font-bold">{symbol} {offerUnitPrice.toLocaleString()}</span> <span className="line-through text-gray-400">{symbol} {unitPrice.toLocaleString()}</span></>
                        ) : (
                          <span className="font-bold">{symbol} {unitPrice.toLocaleString()}</span>
                        )}
                      </span>
                    </div>
                    {crossSellDiscount && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span className="flex items-center gap-1"><Gift size={10} /> {crossSellDiscount.label || 'Cross-sell'}</span>
                        <span>-{crossSellDiscount.value}{crossSellDiscount.type === 'percentage' ? '%' : ` ${symbol}`}</span>
                      </div>
                    )}
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
                    {bestDiscount.type === 'crosssell' && (
                      <div className="flex justify-between text-xs text-green-600" data-testid="enroll-discount-crosssell">
                        <span className="flex items-center gap-1"><Gift size={10} /> {crossSellDiscount.label || 'Cross-Sell'}</span>
                        <span>-{symbol} {crossSellDiscount.amount.toLocaleString()}</span>
                      </div>
                    )}
                    {bestDiscount.type === 'vip' && (
                      <div className="flex justify-between text-xs text-purple-600" data-testid="enroll-discount-vip">
                        <span className="flex items-center gap-1"><Star size={10} /> {vipOffer?.label || 'VIP Offer'}</span>
                        <span>-{symbol} {vipDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    {autoDiscounts.combo_discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600" data-testid="enroll-discount-combo">
                        <span>Combo Discount</span><span>-{symbol} {autoDiscounts.combo_discount.toLocaleString()}</span>
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

                {/* What Clients Say - Session testimonials */}
                {type === 'session' && sessionTestimonials.length > 0 && (
                  <div className="p-5 border-t" data-testid="enrollment-testimonials">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif", color: '#4c1d95' }}>
                      <Quote size={14} className="text-purple-300" /> What Clients Say
                    </h3>
                    <div className="space-y-3">
                      {sessionTestimonials.slice(0, 3).map((t, idx) => (
                        <div key={t.id || idx} className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 relative" data-testid={`enroll-testimonial-${idx}`}>
                          <Quote size={12} className="text-purple-200 absolute top-2 left-2" />
                          <p className="text-gray-600 text-[11px] leading-relaxed italic pl-5 mb-1.5">{t.text}</p>
                          <p className="text-[10px] text-purple-700/70 font-medium pl-5">{t.client_name || 'Anonymous'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Urgency Testimonial Strip - inside sticky card */}
                {urgencyQuotes.length > 0 && (
                  <div className="px-5 pb-5">
                    <UrgencyStrip quotes={urgencyQuotes} />
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Registration Form (scrollable) */}
            <div className="lg:w-3/5">
              <StepBar current={step} steps={['Details & Verify', 'Pay']} />

              {paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                <div className="rounded-xl p-4 mb-4 border-2 shadow-sm" data-testid="payment-disclaimer-persistent"
                  style={{
                    backgroundColor: paymentSettings.disclaimer_style?.bg_color || '#fef2f2',
                    borderColor: paymentSettings.disclaimer_style?.border_color || '#f87171',
                  }}>
                  <p style={{
                    fontSize: paymentSettings.disclaimer_style?.font_size || '14px',
                    fontWeight: paymentSettings.disclaimer_style?.font_weight || '600',
                    color: paymentSettings.disclaimer_style?.font_color || '#991b1b',
                    lineHeight: '1.5',
                  }}>
                    {paymentSettings.disclaimer.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
                      }
                      return part;
                    })}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-xl border shadow-sm p-5 md:p-6">
                {/* Step 0: Participants + Promo + OTP */}
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

                    {/* Promo Code */}
                    <div className="border-t pt-4 mt-2 mb-4">
                      <label className="text-xs font-medium text-gray-700 mb-1 block flex items-center gap-1.5"><Tag size={12} className="text-[#D4AF37]" /> Promo Code</label>
                      <div className="flex gap-2">
                        <Input data-testid="promo-code-input" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Enter code" className="text-sm flex-1" disabled={!!promoResult} />
                        {promoResult ? <Button size="sm" variant="outline" onClick={() => { setPromoResult(null); setPromoCode(''); }}>Remove</Button>
                          : <Button size="sm" onClick={validatePromo} disabled={promoLoading || !promoCode.trim()} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs">
                              {promoLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
                            </Button>}
                      </div>
                      {promoResult && <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1"><Check size={12} className="text-green-600" /><span className="text-xs text-green-700">Saving {symbol} {discount.toLocaleString()}</span></div>}
                    </div>

                    {/* Email Verification */}
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <Mail size={14} className="text-[#D4AF37]" /> Verify Your Email
                      </h3>
                      <p className="text-[10px] text-gray-500 mb-3">
                        We'll send a code to <strong>{bookerEmail || 'your email'}</strong> to confirm your enrollment.
                      </p>

                      {!otpSent && !emailVerified && (
                        <Button data-testid="send-otp-btn" onClick={submitAndSendOtp} disabled={loading} className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                          {loading ? <Loader2 className="animate-spin" size={16} /> : <><Mail size={14} className="mr-2" /> Send Verification Code</>}
                        </Button>
                      )}

                      {otpSent && !emailVerified && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <p className="text-xs text-gray-600 mb-2">Enter the verification code sent to <strong>{bookerEmail}</strong></p>
                          <div className="flex gap-2">
                            <Input data-testid="enroll-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                            <Button data-testid="verify-otp-btn" onClick={verifyOtp} disabled={loading || otp.length !== 6} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                              {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}</Button>
                          </div>
                          <button onClick={() => { setOtpSent(false); setOtp(''); }} className="text-[10px] text-purple-600 mt-2 hover:underline">Resend code / change email</button>
                        </div>
                      )}

                      {emailVerified && (
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                            <ShieldCheck size={14} className="text-green-600" />
                            <span className="text-xs text-green-700 font-medium">{bookerEmail} — Verified</span>
                          </div>
                          <Button data-testid="step0-next" onClick={() => setStep(1)}
                            className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-3">
                            Continue to Payment <ChevronRight size={16} className="ml-1" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 1: Pay */}
                {step === 1 && (
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
                          <Button variant="outline" onClick={() => setStep(0)} className="rounded-full"><ChevronLeft size={16} /></Button>
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
                    {detectedCountry === 'IN' && paymentSettings.india_enabled && (
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

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3" data-testid="india-pricing-note">
                          <p className="text-[10px] text-amber-800 leading-relaxed">
                            <strong>Please note:</strong> Indian payment methods (UPI, GPay, bank transfer) may result in the total price being 12-15% higher due to additional processing and platform charges.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Preserve resume URL so back button restores state
                            window.history.replaceState(null, '', `/enroll/${type}/${id}?tier=${selectedTier || 0}&resume=${enrollmentId}`);
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
                              <p className="text-[10px] text-gray-500">GPay, Cards, NEFT supported</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600" />
                        </button>

                        {paymentSettings.manual_form_enabled && (
                        <button
                          onClick={() => {
                            window.history.replaceState(null, '', `/enroll/${type}/${id}?tier=${selectedTier || 0}&resume=${enrollmentId}`);
                            navigate(`/manual-payment/${enrollmentId}`);
                          }}
                          className="flex items-center justify-between w-full border rounded-lg p-4 mt-2 hover:border-teal-400 hover:bg-teal-50/50 transition-all group"
                          data-testid="manual-payment-option">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                              <FileText size={14} className="text-teal-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 group-hover:text-teal-600">Submit Manual Payment</span>
                              <p className="text-[10px] text-teal-600 font-medium">Cash deposit, bank transfer — upload proof for approval</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-teal-600" />
                        </button>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(0)} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="pay-now-btn" onClick={handleCheckout} disabled={processing}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                        {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> {total <= 0 ? 'Registering...' : 'Redirecting...'}</> : total <= 0 ? <><Check size={14} className="mr-2" /> Complete Registration</> : <><Lock size={14} className="mr-2" /> Pay {symbol} {total.toLocaleString()}</>}
                      </Button>
                    </div>

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
