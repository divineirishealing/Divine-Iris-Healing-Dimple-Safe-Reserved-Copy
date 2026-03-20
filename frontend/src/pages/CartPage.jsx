import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { resolveImageUrl } from '../lib/imageUtils';
import {
  ShoppingCart, Trash2, Plus, User, Monitor, Wifi, ChevronRight, ChevronDown, ChevronUp,
  Bell, BellOff, Copy, Tag, Mail, Loader2, Check, Lock, Gift
} from 'lucide-react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "IN", name: "India" }, { code: "AE", name: "UAE" }, { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" }, { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "SG", name: "Singapore" }, { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "SA", name: "Saudi Arabia" }, { code: "QA", name: "Qatar" }, { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" }, { code: "LK", name: "Sri Lanka" }, { code: "MY", name: "Malaysia" },
  { code: "JP", name: "Japan" }, { code: "ZA", name: "South Africa" }, { code: "NP", name: "Nepal" },
  { code: "KW", name: "Kuwait" }, { code: "OM", name: "Oman" }, { code: "BH", name: "Bahrain" },
  { code: "PH", name: "Philippines" }, { code: "ID", name: "Indonesia" }, { code: "TH", name: "Thailand" },
  { code: "KE", name: "Kenya" }, { code: "NG", name: "Nigeria" }, { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" }, { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
].sort((a, b) => a.name.localeCompare(b.name));
const GENDERS = ["Female", "Male", "Non-Binary", "Prefer not to say"];
const RELATIONSHIPS = ["Myself", "Mother", "Father", "Sister", "Brother", "Son", "Daughter", "Spouse", "Husband", "Wife", "Grandmother", "Grandfather", "Grandson", "Granddaughter", "Friend", "Colleague", "Relative", "Other"];

const REFERRAL_SOURCES = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Spotify", "Google Search", "Friend / Family", "WhatsApp", "Other"];

const COUNTRIES_PHONE = [
  { code: "IN", phone: "+91" }, { code: "AE", phone: "+971" }, { code: "US", phone: "+1" },
  { code: "GB", phone: "+44" }, { code: "CA", phone: "+1" }, { code: "AU", phone: "+61" },
  { code: "SG", phone: "+65" }, { code: "DE", phone: "+49" }, { code: "FR", phone: "+33" },
  { code: "SA", phone: "+966" }, { code: "QA", phone: "+974" }, { code: "PK", phone: "+92" },
  { code: "BD", phone: "+880" }, { code: "LK", phone: "+94" }, { code: "MY", phone: "+60" },
  { code: "JP", phone: "+81" }, { code: "ZA", phone: "+27" }, { code: "NP", phone: "+977" },
  { code: "KW", phone: "+965" }, { code: "OM", phone: "+968" }, { code: "BH", phone: "+973" },
  { code: "PH", phone: "+63" }, { code: "ID", phone: "+62" }, { code: "TH", phone: "+66" },
  { code: "KE", phone: "+254" }, { code: "NG", phone: "+234" }, { code: "EG", phone: "+20" },
  { code: "TR", phone: "+90" }, { code: "IT", phone: "+39" }, { code: "ES", phone: "+34" },
  { code: "NL", phone: "+31" }, { code: "NZ", phone: "+64" },
];

const emptyParticipant = (mode = 'online') => ({
  name: '', relationship: '', age: '', gender: '',
  country: '', city: '', state: '', attendance_mode: mode, notify: true, email: '', phone: '', whatsapp: '',
  phone_code: '', wa_code: '',
  is_first_time: true, referral_source: '',
});

const CartItemCard = ({ item, onRemove, onUpdateParticipants, symbol, getItemPrice, getItemOfferPrice, showReferral, detectedCountry, copySource }) => {
  const [expanded, setExpanded] = useState(true);
  const tier = item.durationTiers?.[item.tierIndex];
  const price = getItemPrice(item);
  const offerPrice = getItemOfferPrice(item);
  const effectivePrice = offerPrice > 0 ? offerPrice : price;
  const pCount = item.participants.length;
  const isSession = item.type === 'session';

  const updateParticipant = (idx, field, value) => {
    const updated = [...item.participants];
    const prev = updated[idx];
    updated[idx] = { ...prev, [field]: value };
    // When switching to online, force notify on
    if (field === 'attendance_mode' && value === 'online') {
      updated[idx].notify = true;
    }
    onUpdateParticipants(updated);
  };

  const addParticipant = () => {
    const p = emptyParticipant(item.sessionMode === 'remote' ? 'offline' : 'online');
    if (detectedCountry) {
      p.country = detectedCountry;
      const c = COUNTRIES.find(c => c.code === detectedCountry);
      if (c) { p.phone_code = c.phone; p.wa_code = c.phone; }
    }
    onUpdateParticipants([...item.participants, p]);
  };

  const removeParticipant = (idx) => {
    if (item.participants.length <= 1) return;
    onUpdateParticipants(item.participants.filter((_, i) => i !== idx));
  };

  return (
    <div data-testid={`cart-item-${item.id}`} className="bg-white rounded-xl border shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 border-b">
        {isSession ? (
          <div className="w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #4c1d95 100%)' }}>
            <span className="text-[8px] text-[#D4AF37] font-medium tracking-wider uppercase text-center leading-tight px-1">Personal Session</span>
          </div>
        ) : (
          <img src={resolveImageUrl(item.programImage)} alt={item.programTitle}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            onError={e => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=100&h=100&fit=crop'; }} />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{item.programTitle}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isSession ? (
              <>
                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">Personal Session</span>
                {item.duration && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.duration}</span>}
                {item.selectedDate && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{item.selectedDate}</span>}
                {item.selectedTime && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{item.selectedTime}</span>}
              </>
            ) : (
              <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-full font-medium">{tier?.label || 'Standard'}</span>
            )}
            {offerPrice > 0 ? (
              <span className="text-[10px] text-gray-400"><span className="text-[#D4AF37] font-medium">{symbol} {offerPrice.toLocaleString()}</span> <span className="line-through">{symbol} {price.toLocaleString()}</span> / person</span>
            ) : (
              <span className="text-[10px] text-gray-400">{symbol} {price.toLocaleString()} / person</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#D4AF37]">{symbol} {(effectivePrice * pCount).toLocaleString()}</span>
          <button onClick={onRemove} data-testid={`cart-remove-${item.id}`} className="text-red-400 hover:text-red-600 transition-colors p-1">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Participants toggle */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
        <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <User size={14} className="text-[#D4AF37]" />
          {pCount} Participant{pCount > 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {/* Copy from first program */}
      {copySource && expanded && (
        <div className="px-4 pb-2">
          <button
            type="button"
            data-testid={`copy-details-${item.id}`}
            onClick={() => {
              const source = copySource.participants || [];
              if (source.length === 0) return;
              const copied = source.map(p => ({ ...p }));
              onUpdateParticipants(copied);
            }}
            className="w-full text-[10px] py-2 rounded-lg border-2 border-dashed border-[#5D3FD3]/30 text-[#5D3FD3] font-semibold hover:bg-[#5D3FD3]/5 transition-colors flex items-center justify-center gap-1.5"
          >
            <Copy size={12} /> Same details as {copySource.programTitle}
          </button>
        </div>
      )}

      {/* Participants */}
      {expanded && (
        <div className="px-4 pb-4">
          {item.participants.map((p, idx) => (
            <div key={idx} data-testid={`cart-participant-${item.id}-${idx}`}
              className="border rounded-lg p-3 mb-2 bg-gray-50 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-[#D4AF37]">Participant {idx + 1}</span>
                {item.participants.length > 1 && (
                  <button onClick={() => removeParticipant(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div><label className="text-[9px] text-gray-500">Name *</label>
                  <Input value={p.name} onChange={e => updateParticipant(idx, 'name', e.target.value)}
                    placeholder="Full name" className="text-xs h-8" data-testid={`cp-name-${item.id}-${idx}`} /></div>
                <div><label className="text-[9px] text-gray-500">Relationship *</label>
                  <select value={p.relationship} onChange={e => updateParticipant(idx, 'relationship', e.target.value)}
                    className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
                    <option value="">Select</option>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div><label className="text-[9px] text-gray-500">Age *</label>
                  <Input type="number" min="5" max="120" value={p.age}
                    onChange={e => updateParticipant(idx, 'age', e.target.value)}
                    placeholder="Age" className="text-xs h-8" /></div>
                <div><label className="text-[9px] text-gray-500">Gender *</label>
                  <select value={p.gender} onChange={e => updateParticipant(idx, 'gender', e.target.value)}
                    className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
                    <option value="">Select</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select></div>
                <div><label className="text-[9px] text-gray-500">Country *</label>
                  <select value={p.country} onChange={e => {
                    const code = e.target.value;
                    const c = COUNTRIES_PHONE.find(c => c.code === code);
                    const updated = [...item.participants];
                    updated[idx] = { ...p, country: code, city: '', state: '', phone_code: c ? c.phone : '', wa_code: c ? c.phone : '' };
                    onUpdateParticipants(updated);
                  }} className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8">
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div><label className="text-[9px] text-gray-500">City *</label>
                  <Input value={p.city || ''} onChange={e => updateParticipant(idx, 'city', e.target.value)} placeholder="City" className="text-xs h-8" /></div>
                <div><label className="text-[9px] text-gray-500">State *</label>
                  <Input value={p.state || ''} onChange={e => updateParticipant(idx, 'state', e.target.value)} placeholder="State / Province" className="text-xs h-8" /></div>
              </div>
              <div className="flex gap-1 mb-1">
                {item.enable_online !== false && (
                  <button type="button" onClick={() => updateParticipant(idx, 'attendance_mode', 'online')}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
                      p.attendance_mode === 'online' ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-gray-200 text-gray-500'}`}>
                    <span className="flex items-center gap-1"><Monitor size={10} /> Online (Zoom)</span>
                    <span className="text-[8px] opacity-70">via Zoom</span>
                  </button>
                )}
                {item.enable_offline !== false && (
                  <button type="button" onClick={() => updateParticipant(idx, 'attendance_mode', 'offline')}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
                      p.attendance_mode === 'offline' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                    <span className="flex items-center gap-1"><Wifi size={10} /> Offline</span>
                    <span className="text-[8px] opacity-70">Remote, Not In-Person</span>
                  </button>
                )}
                {item.enable_in_person && (
                  <button type="button" onClick={() => updateParticipant(idx, 'attendance_mode', 'in_person')}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded border text-[10px] transition-all ${
                      p.attendance_mode === 'in_person' ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                    <span className="flex items-center gap-1"><Wifi size={10} /> Offline</span>
                    <span className="text-[8px] opacity-70">Remote, Not In-Person</span>
                  </button>
                )}
              </div>
              {!item.enable_in_person && (
                <p className="text-[8px] text-gray-400 mb-1 italic">All sessions are online via Zoom or remote distance healing — no in-person sessions at this time.</p>
              )}

              {/* Divine Iris membership status — two buttons matching EnrollmentPage */}
              <div className="mb-2 mt-2">
                <label className="text-[9px] text-gray-500 mb-1 block">Are you new to Divine Iris? *</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => updateParticipant(idx, 'is_first_time', true)}
                    className={`flex-1 py-2 rounded-lg border text-[10px] font-medium transition-all ${
                      p.is_first_time === true ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    First time joining Divine Iris
                  </button>
                  <button type="button" onClick={() => updateParticipant(idx, 'is_first_time', false)}
                    className={`flex-1 py-2 rounded-lg border text-[10px] font-medium transition-all ${
                      p.is_first_time === false ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    I am Divine Iris Soul Tribe
                  </button>
                </div>
              </div>

              {/* Referral source — only shown for first-timers */}
              {p.is_first_time && (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-500">How did you hear about us?</label>
                    <select value={p.referral_source || ''} onChange={e => updateParticipant(idx, 'referral_source', e.target.value)}
                      className="w-full border rounded-md px-2 py-1.5 text-xs bg-white h-8" data-testid={`cp-referral-${item.id}-${idx}`}>
                      <option value="">Select (optional)</option>{REFERRAL_SOURCES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {p.referral_source === 'Friend / Family' && (
                    <div>
                      <label className="text-[9px] text-gray-500">Referred by</label>
                      <Input type="text" value={p.referred_by_name || ''} onChange={e => updateParticipant(idx, 'referred_by_name', e.target.value)} placeholder="Referrer's name" className="text-xs h-8" />
                    </div>
                  )}
                </div>
              )}

              {showReferral && (
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer mb-1.5" data-testid={`cp-referred-toggle-${item.id}-${idx}`}>
                    <input type="checkbox" checked={p.has_referral || false} onChange={e => updateParticipant(idx, 'has_referral', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
                    <span className="text-[10px] text-gray-600">Referred by a Divine Iris member</span>
                  </label>
                  {p.has_referral && (
                    <Input value={p.referred_by_name || ''} onChange={e => updateParticipant(idx, 'referred_by_name', e.target.value)} placeholder="Referrer's name" className="text-xs h-8 mb-2" />
                  )}
                </>
              )}

              {/* Notify — mandatory for online, optional otherwise (matching EnrollmentPage) */}
              {p.attendance_mode === 'online' ? (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Bell size={10} className="text-[#D4AF37]" />
                  <span className="text-[10px] text-[#D4AF37] font-medium">Notification will be sent to Participant</span>
                </div>
              ) : (
                <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`cp-notify-${item.id}-${idx}`}>
                  <input type="checkbox" checked={p.notify} onChange={e => updateParticipant(idx, 'notify', e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#D4AF37]" />
                  <span className="text-[10px] text-gray-600 flex items-center gap-1">
                    {p.notify ? <Bell size={10} className="text-[#D4AF37]" /> : <BellOff size={10} className="text-gray-400" />} Notify this participant
                  </span>
                </label>
              )}
              {p.notify && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Input value={p.email || ''} onChange={e => updateParticipant(idx, 'email', e.target.value)} placeholder="Email" className="text-xs h-8" data-testid={`cp-email-${item.id}-${idx}`} />
                  <div className="flex gap-0.5">
                    <span className="border rounded-md px-1.5 py-1 text-[10px] w-[60px] bg-gray-50 h-8 flex-shrink-0 flex items-center justify-center text-gray-600">
                      {p.phone_code || '—'}
                    </span>
                    <Input value={p.phone || ''} onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      const shouldSync = !p.whatsapp || p.whatsapp === p.phone;
                      const updated = [...item.participants];
                      updated[idx] = { ...p, phone: val, ...(shouldSync ? { whatsapp: val } : {}) };
                      onUpdateParticipants(updated);
                    }} placeholder="Phone (10 digits)" maxLength={10} className="text-xs h-8" data-testid={`cp-phone-${item.id}-${idx}`} />
                  </div>
                  <div className="flex gap-0.5">
                    <span className="border rounded-md px-1.5 py-1 text-[10px] w-[60px] bg-gray-50 h-8 flex-shrink-0 flex items-center justify-center text-gray-600">
                      {p.wa_code || '—'}
                    </span>
                    <div className="relative flex-1">
                      <Input value={p.whatsapp || ''} onChange={e => updateParticipant(idx, 'whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="WhatsApp (10 digits)" maxLength={10} className="text-xs h-8 pl-7" />
                      <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.67-1.228A11.947 11.947 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.352 0-4.55-.743-6.357-2.012l-.232-.168-3.227.85.862-3.147-.185-.239A9.96 9.96 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button onClick={addParticipant} data-testid={`cart-add-participant-${item.id}`}
            className="w-full border border-dashed border-[#D4AF37]/40 rounded-lg py-2 flex items-center justify-center gap-1 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors">
            <Plus size={14} /> Add Participant
          </button>
        </div>
      )}
    </div>
  );
};

function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateItemParticipants, clearCart } = useCart();
  const { getPrice, getOfferPrice, symbol, baseCurrency, country: detectedCountry } = useCurrency();
  const { toast } = useToast();
  const [discountSettings, setDiscountSettings] = useState({ enable_referral: true });
  const [paymentDisclaimer, setPaymentDisclaimer] = useState('');
  const [disclaimerStyle, setDisclaimerStyle] = useState({});
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const currency = baseCurrency;

  // Country is NOT auto-filled — user must select manually

  useEffect(() => {
    axios.get(`${API}/discounts/settings`).then(r => setDiscountSettings(r.data)).catch(() => {});
    axios.get(`${API}/settings`).then(r => {
      if (r.data.payment_disclaimer_enabled !== false && r.data.payment_disclaimer) {
        setPaymentDisclaimer(r.data.payment_disclaimer);
        if (r.data.payment_disclaimer_style) setDisclaimerStyle(r.data.payment_disclaimer_style);
      }
    }).catch(() => {});
  }, []);

  const getItemPrice = (item) => {
    if (item.type === 'session') {
      const fakeProgram = { is_flagship: false, duration_tiers: [], price_aed: item.price_aed, price_inr: item.price_inr, price_usd: item.price_usd };
      return getPrice(fakeProgram);
    }
    const tiers = item.durationTiers || [];
    const fakeProgram = { is_flagship: item.isFlagship, duration_tiers: tiers, price_aed: item.price_aed, price_inr: item.price_inr, price_usd: item.price_usd };
    return getPrice(fakeProgram, item.tierIndex);
  };

  const getItemOfferPrice = (item) => {
    if (item.type === 'session') {
      const fakeProgram = { is_flagship: false, duration_tiers: [], offer_price_aed: item.offer_price_aed, offer_price_inr: item.offer_price_inr, offer_price_usd: item.offer_price_usd };
      return getOfferPrice(fakeProgram);
    }
    const tiers = item.durationTiers || [];
    const fakeProgram = { is_flagship: item.isFlagship, duration_tiers: tiers, offer_price_aed: item.offer_price_aed, offer_price_inr: item.offer_price_inr, offer_price_usd: item.offer_price_usd };
    return getOfferPrice(fakeProgram, item.tierIndex);
  };

  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    return offer > 0 ? offer : getItemPrice(item);
  };

  const totalAmount = items.reduce((sum, item) => {
    return sum + getEffectivePrice(item) * item.participants.length;
  }, 0);

  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  const numPrograms = items.length;

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  useEffect(() => {
    if (totalAmount <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: numPrograms, num_participants: totalParticipants,
          subtotal: totalAmount, email: '', currency: baseCurrency,
          program_ids: items.map(i => i.programId),
          cart_items: items.map(i => ({ program_id: i.programId, tier_index: i.tierIndex })),
        });
        setAutoDiscounts(res.data);
      } catch { setAutoDiscounts({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 }); }
    };
    const timer = setTimeout(fetchDiscounts, 300);
    return () => clearTimeout(timer);
  }, [totalAmount, totalParticipants, numPrograms]);

  const validateAndProceed = () => {
    for (const item of items) {
      for (let i = 0; i < item.participants.length; i++) {
        const p = item.participants[i];
        if (!p.name.trim()) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs a name`, variant: 'destructive' }); return false; }
        if (!p.relationship) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs relationship`, variant: 'destructive' }); return false; }
        if (!p.age || parseInt(p.age) < 5) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs valid age (5+)`, variant: 'destructive' }); return false; }
        if (!p.gender) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs gender`, variant: 'destructive' }); return false; }
        if (!p.country) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs country`, variant: 'destructive' }); return false; }
        if (!p.city || !p.city.trim()) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs city`, variant: 'destructive' }); return false; }
        if (!p.state || !p.state.trim()) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs state`, variant: 'destructive' }); return false; }
        if (p.notify || p.attendance_mode === 'online') {
          if (!p.email || !p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs a valid email`, variant: 'destructive' }); return false; }
          if (!p.phone || !p.phone.trim()) { toast({ title: `${item.programTitle}: Participant ${i + 1} needs a phone number`, variant: 'destructive' }); return false; }
        }
      }
    }
    return true;
  };

  // Auto-derive booker from first participant
  const firstP = items[0]?.participants?.[0] || {};
  const bookerName = firstP.name || '';
  const bookerEmail = firstP.email || '';
  const bookerCountry = firstP.country || '';
  const bookerCity = firstP.city || '';
  const bookerState = firstP.state || '';
  const phone = firstP.phone || '';
  const countryCode = firstP.phone_code || '';

  const discount = (() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === 'percentage') return Math.round(totalAmount * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, { code: promoCode.trim(), program_id: items[0]?.programId, currency });
      setPromoResult(res.data); toast({ title: res.data.message });
    } catch { setPromoResult(null); toast({ title: 'Invalid Code', variant: 'destructive' }); }
    finally { setPromoLoading(false); }
  };

  const submitAndSendOtp = async () => {
    if (!validateAndProceed()) return;
    if (!bookerEmail) return toast({ title: 'Participant email is required for verification', variant: 'destructive' });

    setLoading(true);
    try {
      const bookerPhone = phone ? `${countryCode}${phone}` : null;
      const allParticipants = items.flatMap(item =>
        item.participants.map(p => ({
          name: p.name, relationship: p.relationship, age: parseInt(p.age),
          gender: p.gender, country: p.country, attendance_mode: p.attendance_mode,
          notify: p.notify, email: p.email || null,
          phone: p.notify && p.phone ? `${p.phone_code || ''}${p.phone}` : null,
          whatsapp: p.whatsapp ? `${p.wa_code || ''}${p.whatsapp}` : null,
          program_id: item.programId, program_title: item.programTitle,
          is_first_time: p.is_first_time || false, referral_source: p.referral_source || '',
          referred_by_name: p.has_referral ? (p.referred_by_name || '') : '',
        }))
      );

      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        booker_city: bookerCity, booker_state: bookerState,
        participants: allParticipants,
      });
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      setVpnDetected(enrollRes.data.vpn_detected);
      if (bookerPhone) {
        await axios.patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhone }).catch(() => {});
      }
      await axios.post(`${API}/enrollment/${eid}/send-otp`, { email: bookerEmail });
      setOtpSent(true);
      toast({ title: 'Verification code sent to your email!' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.detail || 'Failed', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast({ title: 'Enter 6-digit code', variant: 'destructive' });
    setLoading(true);
    try {
      await axios.post(`${API}/enrollment/${enrollmentId}/verify-otp`, { email: bookerEmail, otp });
      setEmailVerified(true);
      toast({ title: 'Email verified!' });
      // Navigate to payment page with enrollment ID
      navigate(`/cart/checkout?eid=${enrollmentId}&promo=${promoResult?.code || ''}`);
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Wrong code', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="pt-24 pb-16 flex flex-col items-center justify-center min-h-[60vh]">
          <ShoppingCart size={64} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 text-sm mb-6">Browse our programs and add them to your cart</p>
          <Button onClick={() => navigate('/')} className="bg-[#D4AF37] hover:bg-[#b8962e] text-white rounded-full px-8">Browse Programs</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 data-testid="cart-title" className="text-2xl md:text-3xl text-gray-900">Your Cart</h1>
              <p className="text-sm text-gray-500 mt-1">{items.length} item{items.length > 1 ? 's' : ''} &middot; {totalParticipants} participant{totalParticipants > 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => { clearCart(); toast({ title: 'Cart cleared' }); }} data-testid="clear-cart-btn"
              className="text-xs text-red-500 hover:text-red-700 transition-colors">Clear All</button>
          </div>

          {/* Cart items */}
          {items.map((item, itemIdx) => (
            <CartItemCard key={item.id} item={item}
              onRemove={() => removeItem(item.id)}
              onUpdateParticipants={(p) => updateItemParticipants(item.id, p)}
              symbol={symbol} getItemPrice={getItemPrice} getItemOfferPrice={getItemOfferPrice}
              showReferral={discountSettings.enable_referral} detectedCountry={detectedCountry}
              copySource={itemIdx > 0 ? items[0] : null} />
          ))}

          {/* Summary, Promo & Verification */}
          <div className="bg-white rounded-xl border shadow-sm p-5 mt-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Subtotal ({totalParticipants} participant{totalParticipants > 1 ? 's' : ''})</span>
              <span className="text-sm text-gray-600">{symbol} {totalAmount.toLocaleString()}</span>
            </div>
            {autoDiscounts.group_discount > 0 && (
              <div className="flex justify-between items-center text-xs text-green-600 mb-0.5" data-testid="cart-discount-group">
                <span>Group Discount ({totalParticipants} people)</span><span>-{symbol} {autoDiscounts.group_discount.toLocaleString()}</span>
              </div>
            )}
            {autoDiscounts.combo_discount > 0 && (
              <div className="flex justify-between items-center text-xs text-green-600 mb-0.5" data-testid="cart-discount-combo">
                <span>Combo Discount ({numPrograms} programs)</span><span>-{symbol} {autoDiscounts.combo_discount.toLocaleString()}</span>
              </div>
            )}
            {autoDiscounts.cross_sell_discount > 0 && (
              <div className="flex justify-between items-center text-xs text-green-600 mb-0.5" data-testid="cart-discount-crosssell">
                <span className="flex items-center gap-1"><Gift size={10} /> Cross-Sell Discount</span><span>-{symbol} {autoDiscounts.cross_sell_discount.toLocaleString()}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between items-center text-xs text-green-600 mb-0.5">
                <span>Promo ({promoResult?.code})</span><span>-{symbol} {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t pt-3 mt-3">
              <span className="font-bold text-lg text-gray-900">Total</span>
              <span className="font-bold text-lg text-[#D4AF37]">{symbol} {Math.max(0, totalAmount - discount - (autoDiscounts.total_discount || 0)).toLocaleString()}</span>
            </div>

            {/* Promo Code */}
            <div className="border-t pt-4 mt-4">
              <label className="text-xs font-medium text-gray-700 mb-1 block flex items-center gap-1.5"><Tag size={12} className="text-[#D4AF37]" /> Promo Code</label>
              <div className="flex gap-2">
                <Input data-testid="cart-promo-input" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Enter code" className="text-sm flex-1" disabled={!!promoResult} />
                {promoResult ? (
                  <Button size="sm" variant="outline" onClick={() => { setPromoResult(null); setPromoCode(''); }} className="text-xs">Remove</Button>
                ) : (
                  <Button size="sm" onClick={validatePromo} disabled={promoLoading || !promoCode.trim()}
                    className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs">
                    {promoLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
                  </Button>
                )}
              </div>
              {promoResult && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1">
                  <Check size={12} className="text-green-600" /><span className="text-xs text-green-700">{promoResult.message}</span>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            {paymentDisclaimer && (
              <div className="rounded-xl p-4 mt-4 border-2 shadow-sm" data-testid="cart-payment-disclaimer-page"
                style={{ backgroundColor: disclaimerStyle.bg_color || '#fef2f2', borderColor: disclaimerStyle.border_color || '#f87171' }}>
                <p style={{ fontSize: disclaimerStyle.font_size || '14px', fontWeight: disclaimerStyle.font_weight || '600', color: disclaimerStyle.font_color || '#991b1b', lineHeight: '1.5' }}>
                  {paymentDisclaimer.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              </div>
            )}

            {/* Email Verification */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Mail size={14} className="text-[#D4AF37]" /> Verify & Proceed
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                We'll send a code to <strong>{bookerEmail || 'your email'}</strong> to confirm enrollment.
              </p>

              {!otpSent && !emailVerified && (
                <Button data-testid="cart-send-otp" onClick={submitAndSendOtp} disabled={loading}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <><Mail size={14} className="mr-2" /> Send Verification Code</>}
                </Button>
              )}

              {otpSent && !emailVerified && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-xs text-gray-600 mb-2">Enter the code sent to <strong>{bookerEmail}</strong></p>
                  <div className="flex gap-2">
                    <Input data-testid="cart-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
                      className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                    <Button data-testid="cart-verify-otp" onClick={verifyOtp} disabled={loading || otp.length !== 6}
                      className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                      {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}
                    </Button>
                  </div>
                  <button onClick={() => { setOtpSent(false); setOtp(''); }} className="text-[10px] text-purple-600 mt-2 hover:underline">Resend code / change email</button>
                </div>
              )}

              {emailVerified && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-600" />
                  <span className="text-xs text-green-700 font-medium">{bookerEmail} — Verified</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default CartPage;
