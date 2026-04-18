import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ShoppingCart, Trash2, User, Copy, Tag, Mail, Loader2, Check, Lock, Gift, Star
} from 'lucide-react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import MotivationalSignupFlash from '../components/MotivationalSignupFlash';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../lib/authHeaders';
import { buildFullPortalRosterCartParticipants, emptyCartParticipantSlot } from '../lib/dashboardCartPrefill';

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
function cartParticipantAttendanceLabel(p) {
  if (p.attendance_mode === 'online') return 'Online (Zoom)';
  if (p.attendance_mode === 'in_person') return 'In person';
  return 'Offline / remote';
}

/** Short label for row-wise “Email / updates” column (matches at-a-glance table). */
function cartParticipantEmailAtAGlance(p) {
  const wantsNotify = p.attendance_mode === 'online' || p.notify;
  if (!wantsNotify) return '—';
  const em = String(p.email || '').trim();
  if (em) return em;
  return '—';
}

function cartParticipantLocationLabel(p) {
  const city = String(p.city || '').trim();
  const st = String(p.state || '').trim();
  const cc = String(p.country || '').trim();
  if (!city && !st && !cc) return '—';
  const countryLbl = cc ? (COUNTRIES.find((c) => c.code === cc)?.name || cc) : '';
  return [city, st, countryLbl].filter(Boolean).join(', ');
}

function cartParticipantPhoneAtAGlance(p) {
  const ph = String(p.phone || '').trim();
  if (!ph) return '—';
  const code = String(p.phone_code || '').trim();
  return code ? `${code} ${ph}` : ph;
}

function cartParticipantMemberLabel(p) {
  if (p.is_first_time === false) return 'Soul Tribe';
  if (p.is_first_time === true) return 'New';
  return '—';
}

const CartItemCard = ({ item, onRemove, onUpdateParticipants, symbol, getItemPrice, getItemOfferPrice, copySource, crossSellDiscount, vipOffer }) => {
  const navigate = useNavigate();
  const tier = item.durationTiers?.[item.tierIndex];
  const price = getItemPrice(item);
  const offerPrice = getItemOfferPrice(item);
  const effectivePrice = offerPrice > 0 ? offerPrice : price;
  const vipDisc = vipOffer ? (vipOffer.discount_type === 'fixed' ? (vipOffer.discount_amount || 0) : Math.round(effectivePrice * (vipOffer.discount_pct || 0) / 100)) : 0;
  // NO STACKING: best single discount per item
  const bestItemDisc = vipDisc > 0 ? { type: 'vip', amount: vipDisc, label: vipOffer?.label } :
    crossSellDiscount ? { type: 'crosssell', amount: crossSellDiscount.amount, label: crossSellDiscount.label } : { type: 'none', amount: 0 };
  const afterVipPrice = Math.max(0, effectivePrice - bestItemDisc.amount);
  const pCount = item.participants.length;
  const isSession = item.type === 'session';

  const openFullEnrollment = () => {
    if (item.type === 'session') {
      const q = new URLSearchParams();
      if (item.selectedDate) q.set('date', item.selectedDate);
      if (item.selectedTime) q.set('slot', item.selectedTime);
      const qs = q.toString();
      navigate(`/enroll/session/${item.sessionId || item.programId}${qs ? `?${qs}` : ''}`);
    } else {
      navigate(`/enroll/program/${item.programId}?tier=${item.tierIndex ?? 0}`);
    }
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
            {bestItemDisc.amount > 0 ? (
              <span className="text-[10px] text-gray-400"><span className={`font-bold ${bestItemDisc.type === 'vip' ? 'text-purple-600' : 'text-green-600'}`}>{symbol} {afterVipPrice.toLocaleString()}</span> <span className="line-through">{symbol} {effectivePrice.toLocaleString()}</span> / person
                <span className={`text-[8px] ${bestItemDisc.type === 'vip' ? 'text-purple-500' : 'text-green-500'}`}> ({bestItemDisc.label})</span>
              </span>
            ) : offerPrice > 0 ? (
              <span className="text-[10px] text-gray-400"><span className="text-[#D4AF37] font-medium">{symbol} {offerPrice.toLocaleString()}</span> <span className="line-through">{symbol} {price.toLocaleString()}</span> / person</span>
            ) : (
              <span className="text-[10px] text-gray-400">{symbol} {price.toLocaleString()} / person</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-sm font-bold text-[#D4AF37]">{symbol} {(afterVipPrice * pCount).toLocaleString()}</span>
            {bestItemDisc.amount > 0 && (
              <p className={`text-[8px] flex items-center justify-end gap-0.5 ${bestItemDisc.type === 'vip' ? 'text-purple-500' : 'text-green-500'}`}>
                {bestItemDisc.type === 'vip' ? <Star size={8} /> : <Gift size={8} />} -{symbol}{bestItemDisc.amount}
              </p>
            )}
          </div>
          <button onClick={onRemove} data-testid={`cart-remove-${item.id}`} className="text-red-400 hover:text-red-600 transition-colors p-1">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/60 border-t border-gray-100">
        <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          <User size={14} className="text-[#D4AF37]" />
          {pCount} Participant{pCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Row-wise AT A GLANCE — one row per participant (no inline forms) */}
      <div
        data-testid={`cart-one-eye-${item.id}`}
        className="px-4 pt-2 pb-3 border-t border-gray-100"
      >
        <p className="text-[10px] font-semibold text-[#D4AF37] uppercase tracking-[0.12em] mb-2.5">
          At a glance
        </p>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[10px] sm:text-[11px] text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Name</th>
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Role</th>
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Age</th>
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Gender</th>
                <th className="py-2 pr-2 font-semibold align-bottom min-w-[7rem]">Location</th>
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Attendance</th>
                <th className="py-2 pr-2 font-semibold align-bottom min-w-[6.5rem]">Email</th>
                <th className="py-2 pr-2 font-semibold align-bottom whitespace-nowrap">Phone</th>
                <th className="py-2 font-semibold align-bottom whitespace-nowrap">With us</th>
              </tr>
            </thead>
            <tbody>
              {item.participants.map((p, idx) => {
                const name = String(p.name || '').trim() || `Participant ${idx + 1}`;
                const role = String(p.relationship || '').trim() || '—';
                const age = String(p.age || '').trim() || '—';
                const gender = String(p.gender || '').trim() || '—';
                const loc = cartParticipantLocationLabel(p);
                const emailCell = cartParticipantEmailAtAGlance(p);
                const phoneCell = cartParticipantPhoneAtAGlance(p);
                const member = cartParticipantMemberLabel(p);
                return (
                  <tr
                    key={idx}
                    data-testid={`cart-participant-row-${item.id}-${idx}`}
                    className="text-gray-900 border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-2.5 pr-2 font-medium max-w-[8rem] truncate align-top" title={name}>
                      {name}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 max-w-[5rem] truncate align-top" title={role}>
                      {role}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 whitespace-nowrap align-top">{age}</td>
                    <td className="py-2.5 pr-2 text-gray-700 max-w-[5.5rem] truncate align-top" title={gender}>
                      {gender}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 max-w-[10rem] truncate align-top" title={loc}>
                      {loc}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 whitespace-nowrap align-top">
                      {cartParticipantAttendanceLabel(p)}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 max-w-[9rem] truncate align-top" title={emailCell}>
                      {emailCell}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-700 whitespace-nowrap align-top" title={phoneCell}>
                      {phoneCell}
                    </td>
                    <td className="py-2.5 text-gray-700 whitespace-nowrap align-top">{member}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-gray-500 mt-2.5 leading-relaxed">
          Review everyone above, then continue. To change details, use{' '}
          <button
            type="button"
            onClick={openFullEnrollment}
            className="text-[#5D3FD3] font-semibold underline decoration-[#5D3FD3]/40 underline-offset-2 hover:text-[#4a32a8]"
          >
            full enrollment
          </button>
          {' '}or your dashboard before paying.
        </p>
      </div>

      {copySource && (
        <div className="px-4 pb-3">
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
    </div>
  );
};

function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, removeItem, updateItemParticipants, clearCart } = useCart();
  const { getPrice, getOfferPrice, symbol, baseCurrency, country: detectedCountry } = useCurrency();
  const { toast } = useToast();
  const portalCartBackfillInFlight = useRef(false);
  const [discountSettings, setDiscountSettings] = useState({ enable_referral: true, checkout_promo_code_visible: true });
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
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const currency = baseCurrency;
  const showCheckoutPromo = discountSettings.checkout_promo_code_visible !== false;

  useEffect(() => {
    if (discountSettings.checkout_promo_code_visible === false) {
      setPromoCode('');
      setPromoResult(null);
    }
  }, [discountSettings.checkout_promo_code_visible]);

  /** If logged in with Bearer token, recover empty cart rows from /student/enrollment-prefill (same auth as dashboard). */
  useEffect(() => {
    if (items.length === 0) return;
    let token = '';
    try {
      token = localStorage.getItem('session_token') || '';
    } catch {
      return;
    }
    if (!token) return;

    const targets = items.filter(
      (item) =>
        item.type === 'program' &&
        item.participants.length > 0 &&
        item.participants.every((p) => !String(p.name || '').trim()),
    );
    if (targets.length === 0) return;
    if (portalCartBackfillInFlight.current) return;
    portalCartBackfillInFlight.current = true;
    let cancelled = false;

    (async () => {
      try {
        const r = await axios.get(`${API}/student/enrollment-prefill`, {
          withCredentials: true,
          headers: getAuthHeaders(),
        });
        if (cancelled) return;
        const pre = r.data;
        const bookerEmail = (user?.email || '').trim();
        targets.forEach((item) => {
          const roster = buildFullPortalRosterCartParticipants(item, pre, bookerEmail, detectedCountry);
          if (!roster?.length) return;
          const n = item.participants.length;
          const merged = roster.slice(0, n);
          while (merged.length < n) {
            merged.push(emptyCartParticipantSlot(item));
          }
          updateItemParticipants(item.id, merged);
        });
        toast({
          title: 'Filled from your portal',
          description: 'Your profile and saved family list were applied — review each program, then continue.',
        });
      } catch {
        /* not logged in or prefill unavailable */
      } finally {
        portalCartBackfillInFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
      portalCartBackfillInFlight.current = false;
    };
  }, [items, user?.email, detectedCountry, updateItemParticipants, toast]);

  // Country is NOT auto-filled — user must select manually

  useEffect(() => {
    axios
      .get(`${API}/discounts/settings`)
      .then((r) => setDiscountSettings((prev) => ({ ...prev, ...r.data })))
      .catch(() => {});
    axios
      .get(`${API}/settings`)
      .then((r) => {
        if (r.data.payment_disclaimer_enabled !== false && r.data.payment_disclaimer) {
          setPaymentDisclaimer(r.data.payment_disclaimer);
          if (r.data.payment_disclaimer_style) setDisclaimerStyle(r.data.payment_disclaimer_style);
        }
        setUrgencyQuotes(r.data.enrollment_urgency_quotes || []);
        // Canonical flag (admin saves here) — avoids race if /discounts/settings overwrites state without this key
        setDiscountSettings((prev) => ({
          ...prev,
          checkout_promo_code_visible: r.data.checkout_promo_code_visible !== false,
        }));
      })
      .catch(() => {});
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

  const cartProgramIdsForUrgency = useMemo(
    () =>
      [...new Set(items.filter((i) => i.type !== 'session').map((i) => String(i.programId).trim()).filter(Boolean))],
    [items],
  );

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });
  const [crossSellRules, setCrossSellRules] = useState([]);
  const [vipOffers, setVipOffers] = useState({}); // { programId: { matched, label, discount_type, ... } }

  useEffect(() => {
    axios.get(`${API}/discounts/settings`).then(r => {
      if (r.data?.enable_cross_sell && r.data?.cross_sell_rules?.length > 0) {
        setCrossSellRules(r.data.cross_sell_rules.filter(r => r.enabled !== false));
      }
    }).catch(() => {});
  }, []);

  // Check VIP offers for each cart item
  useEffect(() => {
    const firstP = items[0]?.participants?.[0];
    if (!firstP?.email && !firstP?.phone) return;
    const phone = firstP.phone_code ? `${firstP.phone_code}${firstP.phone}` : (firstP.phone || '');
    items.forEach(item => {
      axios.post(`${API}/enrollment/check-vip-offer`, {
        email: firstP.email || '', phone, program_id: item.programId,
      }).then(r => {
        if (r.data?.matched) setVipOffers(prev => ({ ...prev, [item.programId]: r.data }));
        else setVipOffers(prev => { const n = { ...prev }; delete n[item.programId]; return n; });
      }).catch(() => {});
    });
  }, [items.map(i => i.programId).join(','), items[0]?.participants?.[0]?.email, items[0]?.participants?.[0]?.phone]);

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
        item.participants.map(p => {
          const refName = p.has_referral ? (p.referred_by_name || '') : (p.referral_source === 'Friend / Family' ? (p.referred_by_name || '') : '');
          const refEmailRaw = (p.referred_by_email || '').trim().toLowerCase();
          const refEmail = (p.has_referral || p.referral_source === 'Friend / Family') && refEmailRaw ? refEmailRaw : null;
          return {
            name: p.name, relationship: p.relationship, age: parseInt(p.age, 10) || 0,
            gender: p.gender, country: p.country, city: p.city, state: p.state, attendance_mode: p.attendance_mode,
            notify: p.notify, email: p.email || null,
            phone: p.notify && p.phone ? `${p.phone_code || ''}${p.phone}` : null,
            whatsapp: p.whatsapp ? `${p.wa_code || ''}${p.whatsapp}` : null,
            program_id: item.programId, program_title: item.programTitle,
            is_first_time: p.is_first_time || false, referral_source: p.referral_source || '',
            referred_by_name: refName,
            referred_by_email: refEmail,
          };
        })
      );

      const leadItem = items[0];
      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        booker_city: bookerCity, booker_state: bookerState,
        item_type: leadItem?.type === 'session' ? 'session' : 'program',
        item_id: leadItem?.programId || '',
        item_title: leadItem?.programTitle || '',
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

          <MotivationalSignupFlash
            quotes={urgencyQuotes}
            programIds={cartProgramIdsForUrgency.length ? cartProgramIdsForUrgency : undefined}
            globalOnly={cartProgramIdsForUrgency.length === 0}
            className="mb-6"
          />

          {/* Cart items */}
          {items.map((item, itemIdx) => {
            // Calculate cross-sell discount for this specific item
            let itemCrossSell = null;
            for (const rule of crossSellRules) {
              const targets = rule.targets || (rule.get_program_id ? [{ program_id: rule.get_program_id, discount_value: rule.discount_value, discount_type: rule.discount_type }] : []);
              const matchTarget = targets.find(t => String(t.program_id) === String(item.programId));
              if (!matchTarget) continue;
              const buyTier = rule.buy_tier;
              const buyInCart = (buyTier !== '' && buyTier !== undefined && buyTier !== null)
                ? items.some(i => String(i.programId) === String(rule.buy_program_id) && String(i.tierIndex) === String(buyTier))
                : items.some(i => String(i.programId) === String(rule.buy_program_id));
              if (buyInCart) {
                const effPrice = getEffectivePrice(item);
                const disc = matchTarget.discount_type === 'percentage'
                  ? Math.round(effPrice * (matchTarget.discount_value || 0) / 100)
                  : (matchTarget.discount_value || 0);
                itemCrossSell = { amount: disc, label: rule.label, value: matchTarget.discount_value, type: matchTarget.discount_type };
                break;
              }
            }
            return (
              <CartItemCard key={item.id} item={item}
                onRemove={() => removeItem(item.id)}
                onUpdateParticipants={(p) => updateItemParticipants(item.id, p)}
                symbol={symbol} getItemPrice={getItemPrice} getItemOfferPrice={getItemOfferPrice}
                copySource={itemIdx > 0 ? items[0] : null}
                crossSellDiscount={itemCrossSell}
                vipOffer={vipOffers[item.programId] || null} />
            );
          })}

          {/* Summary, Promo & Verification */}
          {(() => {
            // Calculate total cross-sell discount from all items
            let totalCrossSell = 0;
            const crossSellDetails = [];
            for (const item of items) {
              for (const rule of crossSellRules) {
                const targets = rule.targets || (rule.get_program_id ? [{ program_id: rule.get_program_id, discount_value: rule.discount_value, discount_type: rule.discount_type }] : []);
                const matchTarget = targets.find(t => String(t.program_id) === String(item.programId));
                if (!matchTarget) continue;
                const buyTier = rule.buy_tier;
                const buyInCart = (buyTier !== '' && buyTier !== undefined && buyTier !== null)
                  ? items.some(i => String(i.programId) === String(rule.buy_program_id) && String(i.tierIndex) === String(buyTier))
                  : items.some(i => String(i.programId) === String(rule.buy_program_id));
                if (buyInCart) {
                  const effPrice = getEffectivePrice(item);
                  const disc = matchTarget.discount_type === 'percentage'
                    ? Math.round(effPrice * (matchTarget.discount_value || 0) / 100) * item.participants.length
                    : (matchTarget.discount_value || 0) * item.participants.length;
                  totalCrossSell += disc;
                  crossSellDetails.push({ label: rule.label, amount: disc, item: item.programTitle });
                  break;
                }
              }
            }
            // Calculate VIP discounts per item
            let totalVip = 0;
            const vipDetails = [];
            for (const item of items) {
              const vo = vipOffers[item.programId];
              if (vo) {
                const effPrice = getEffectivePrice(item);
                const disc = vo.discount_type === 'fixed' ? (vo.discount_amount || 0) * item.participants.length : Math.round(effPrice * (vo.discount_pct || 0) / 100) * item.participants.length;
                totalVip += disc;
                vipDetails.push({ label: vo.label, amount: disc, item: item.programTitle });
              }
            }
            return (
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
            {totalCrossSell > 0 && crossSellDetails.map((d, i) => (
              <div key={i} className="flex justify-between items-center text-xs text-green-600 mb-0.5" data-testid={`cart-discount-crosssell-${i}`}>
                <span className="flex items-center gap-1"><Gift size={10} /> {d.label || 'Cross-Sell'} ({d.item})</span><span>-{symbol} {d.amount.toLocaleString()}</span>
              </div>
            ))}
            {totalVip > 0 && vipDetails.map((d, i) => (
              <div key={i} className="flex justify-between items-center text-xs text-purple-600 mb-0.5" data-testid={`cart-discount-vip-${i}`}>
                <span className="flex items-center gap-1"><Star size={10} /> {d.label || 'VIP'} ({d.item})</span><span>-{symbol} {d.amount.toLocaleString()}</span>
              </div>
            ))}
            {discount > 0 && (
              <div className="flex justify-between items-center text-xs text-green-600 mb-0.5">
                <span>Promo ({promoResult?.code})</span><span>-{symbol} {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t pt-3 mt-3">
              <span className="font-bold text-lg text-gray-900">Total</span>
              <span className="font-bold text-lg text-[#D4AF37]">{symbol} {Math.max(0, totalAmount - discount - totalCrossSell - totalVip - ((autoDiscounts.group_discount || 0) + (autoDiscounts.combo_discount || 0) + (autoDiscounts.loyalty_discount || 0))).toLocaleString()}</span>
            </div>

            {/* Promo Code */}
            {showCheckoutPromo && (
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
            )}

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
            );
          })()}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default CartPage;
