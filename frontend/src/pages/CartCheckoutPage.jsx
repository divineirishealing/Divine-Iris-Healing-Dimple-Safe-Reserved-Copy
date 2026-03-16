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
import {
  Tag, CreditCard, Mail, Lock, Loader2, Check, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, ShoppingCart, FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "IN", name: "India", phone: "+91" }, { code: "AE", name: "UAE", phone: "+971" },
  { code: "US", name: "United States", phone: "+1" }, { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "CA", name: "Canada", phone: "+1" }, { code: "AU", name: "Australia", phone: "+61" },
  { code: "SG", name: "Singapore", phone: "+65" }, { code: "DE", name: "Germany", phone: "+49" },
  { code: "SA", name: "Saudi Arabia", phone: "+966" }, { code: "QA", name: "Qatar", phone: "+974" },
  { code: "PK", name: "Pakistan", phone: "+92" }, { code: "BD", name: "Bangladesh", phone: "+880" },
  { code: "MY", name: "Malaysia", phone: "+60" }, { code: "JP", name: "Japan", phone: "+81" },
  { code: "FR", name: "France", phone: "+33" }, { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "ZA", name: "South Africa", phone: "+27" }, { code: "NP", name: "Nepal", phone: "+977" },
  { code: "KW", name: "Kuwait", phone: "+965" }, { code: "OM", name: "Oman", phone: "+968" },
  { code: "BH", name: "Bahrain", phone: "+973" }, { code: "PH", name: "Philippines", phone: "+63" },
  { code: "ID", name: "Indonesia", phone: "+62" }, { code: "TH", name: "Thailand", phone: "+66" },
  { code: "KE", name: "Kenya", phone: "+254" }, { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "EG", name: "Egypt", phone: "+20" }, { code: "TR", name: "Turkey", phone: "+90" },
  { code: "IT", name: "Italy", phone: "+39" }, { code: "ES", name: "Spain", phone: "+34" },
  { code: "NL", name: "Netherlands", phone: "+31" }, { code: "NZ", name: "New Zealand", phone: "+64" },
].sort((a, b) => a.name.localeCompare(b.name));

const StepDot = ({ active, done }) => (
  <div className={`w-3 h-3 rounded-full transition-all ${done ? 'bg-green-500' : active ? 'bg-[#D4AF37] scale-110' : 'bg-gray-200'}`} />
);

function CartCheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { country: detectedCountry } = useCurrency();
  const { toast } = useToast();

  const [step, setStep] = useState(0); // 0=Review+Promo, 1=Billing+OTP, 2=Pay
  const [loading, setLoading] = useState(false);

  // Promo
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Billing
  const [bookerName, setBookerName] = useState('');
  const [bookerEmail, setBookerEmail] = useState('');
  const [bookerCountry, setBookerCountry] = useState(detectedCountry || 'AE');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+971');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({ disclaimer: '', disclaimer_enabled: true, india_links: [], india_exly_link: '', india_bank_details: {}, india_enabled: false, manual_form_enabled: true });

  // Multi-factor currency detection (matching EnrollmentPage)
  const AED_COUNTRIES = new Set(['AE', 'SA', 'QA', 'KW', 'OM', 'BH']);
  const allParticipantCountries = items.flatMap(i => i.participants.map(p => p.country)).filter(Boolean);
  const allCountries = [bookerCountry, ...allParticipantCountries].filter(Boolean);
  const allPhoneCodes = [countryCode, ...items.flatMap(i => i.participants.map(p => p.phone_code))].filter(Boolean);
  const hasAnyNonIndia = allCountries.some(c => c !== 'IN') || allPhoneCodes.some(c => c && c !== '+91');

  let activeCurrencyInfo;
  if (allCountries.length === 0) {
    if (detectedCountry === 'IN') activeCurrencyInfo = { currency: 'inr', symbol: 'INR' };
    else if (AED_COUNTRIES.has(detectedCountry)) activeCurrencyInfo = { currency: 'aed', symbol: 'AED' };
    else activeCurrencyInfo = { currency: 'usd', symbol: 'USD' };
  } else if (hasAnyNonIndia) {
    const nonIndiaCountry = allCountries.find(c => c !== 'IN') || allCountries[0];
    if (AED_COUNTRIES.has(nonIndiaCountry)) activeCurrencyInfo = { currency: 'aed', symbol: 'AED' };
    else if (nonIndiaCountry === 'IN') {
      const foreignCode = allPhoneCodes.find(c => c !== '+91');
      const gulfCodes = ['+971', '+966', '+974', '+965', '+968', '+973'];
      activeCurrencyInfo = gulfCodes.includes(foreignCode) ? { currency: 'aed', symbol: 'AED' } : { currency: 'usd', symbol: 'USD' };
    } else {
      if (AED_COUNTRIES.has(nonIndiaCountry)) activeCurrencyInfo = { currency: 'aed', symbol: 'AED' };
      else activeCurrencyInfo = { currency: 'usd', symbol: 'USD' };
    }
  } else {
    activeCurrencyInfo = { currency: 'inr', symbol: 'INR' };
  }
  const currency = activeCurrencyInfo.currency;
  const symbol = activeCurrencyInfo.symbol;

  useEffect(() => {
    if (items.length === 0) navigate('/cart');
  }, [items, navigate]);

  useEffect(() => {
    if (detectedCountry) {
      setBookerCountry(detectedCountry);
      const c = COUNTRIES.find(c => c.code === detectedCountry);
      if (c) setCountryCode(c.phone);
    }
  }, [detectedCountry]);

  useEffect(() => {
    const c = COUNTRIES.find(c => c.code === bookerCountry);
    if (c) setCountryCode(c.phone);
  }, [bookerCountry]);

  // Fetch payment settings
  useEffect(() => {
    axios.get(`${API}/settings`).then(r => {
      const s = r.data;
      setPaymentSettings({
        disclaimer: s.payment_disclaimer || '',
        disclaimer_enabled: s.payment_disclaimer_enabled !== false,
        india_links: (s.india_payment_links || []).filter(l => l.enabled),
        india_alt_discount: s.india_alt_discount_percent || 9,
        india_exly_link: s.india_exly_link || '',
        india_bank_details: s.india_bank_details || {},
        india_enabled: s.india_payment_enabled || false,
        manual_form_enabled: s.manual_form_enabled !== false,
      });
    }).catch(() => {});
  }, []);

  // Local price getters using active currency
  const getItemPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    const key = `price_${currency}`;
    if (tier) return tier[key] || 0;
    return item[key] || 0;
  };

  const getItemOfferPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    if (tier) return tier[`offer_${currency}`] || 0;
    if (currency === 'aed') return item.offer_price_aed || 0;
    if (currency === 'inr') return item.offer_price_inr || 0;
    if (currency === 'usd') return item.offer_price_usd || 0;
    return 0;
  };

  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    return offer > 0 ? offer : getItemPrice(item);
  };

  const subtotal = items.reduce((sum, item) => sum + getEffectivePrice(item) * item.participants.length, 0);
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  const numPrograms = items.length;

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  useEffect(() => {
    if (subtotal <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: numPrograms, num_participants: totalParticipants,
          subtotal, email: bookerEmail, currency,
        });
        setAutoDiscounts(res.data);
      } catch { setAutoDiscounts({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 }); }
    };
    const timer = setTimeout(fetchDiscounts, 300);
    return () => clearTimeout(timer);
  }, [subtotal, totalParticipants, numPrograms, bookerEmail, currency]);

  const discount = (() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === 'percentage') return Math.round(subtotal * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  const totalAutoDiscount = autoDiscounts.total_discount || 0;
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, { code: promoCode.trim(), currency });
      setPromoResult(res.data);
      toast({ title: res.data.message });
    } catch (err) {
      setPromoResult(null);
      toast({ title: 'Invalid Code', description: err.response?.data?.detail || 'Not valid', variant: 'destructive' });
    } finally { setPromoLoading(false); }
  };

  const submitBookerAndSendOtp = async () => {
    if (!bookerName.trim()) return toast({ title: 'Enter your name', variant: 'destructive' });
    if (!bookerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookerEmail)) return toast({ title: 'Enter valid email', variant: 'destructive' });

    setLoading(true);
    try {
      const bookerPhone = phone ? `${countryCode}${phone}` : null;
      const allParticipants = items.flatMap(item =>
        item.participants.map(p => ({
          name: p.name, relationship: p.relationship, age: parseInt(p.age),
          gender: p.gender, country: p.country, attendance_mode: p.attendance_mode,
          notify: p.notify, email: p.email || null,
          phone: p.notify && p.phone ? `${p.phone_code || '+971'}${p.phone}` : null,
          whatsapp: p.whatsapp ? `${p.wa_code || '+971'}${p.whatsapp}` : null,
          program_id: item.programId, program_title: item.programTitle,
          is_first_time: p.is_first_time || false, referral_source: p.referral_source || '',
          referred_by_name: p.has_referral ? (p.referred_by_name || '') : '',
        }))
      );

      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        participants: allParticipants,
      });
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      setVpnDetected(enrollRes.data.vpn_detected);

      // Save booker phone to enrollment
      if (bookerPhone) {
        await axios.patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhone }).catch(() => {});
      }

      // Send email OTP (matching EnrollmentPage)
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

      // If total is $0, auto-complete registration
      if (total <= 0) {
        setProcessing(true);
        try {
          const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
            enrollment_id: enrollmentId, item_type: 'program', item_id: items[0].programId, currency,
            origin_url: window.location.origin, promo_code: promoResult?.code || null,
            tier_index: items[0].tierIndex,
            cart_items: items.map(i => ({ program_id: i.programId, tier_index: i.tierIndex, participants_count: i.participants.length })),
            browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
          });
          clearCart();
          toast({ title: 'Registration complete!' });
          navigate(`/payment/success?session_id=${res.data.session_id}`);
          return;
        } catch (err) {
          toast({ title: 'Error completing registration', variant: 'destructive' });
          setProcessing(false);
        }
      }
      setStep(2);
    } catch (err) {
      toast({ title: err.response?.data?.detail || 'Wrong code', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId, item_type: 'program', item_id: items[0].programId, currency,
        origin_url: window.location.origin, promo_code: promoResult?.code || null,
        tier_index: items[0].tierIndex,
        cart_items: items.map(i => ({ program_id: i.programId, tier_index: i.tierIndex, participants_count: i.participants.length })),
        browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser_languages: navigator.languages ? [...navigator.languages] : [navigator.language],
      });
      clearCart();
      if (res.data.url === '__FREE_SUCCESS__') {
        navigate(`/payment/success?session_id=${res.data.session_id}`);
      } else {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast({ title: 'Payment Error', description: err.response?.data?.detail || 'Try again', variant: 'destructive' });
      setProcessing(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left: Cart Summary (fixed on desktop) */}
            <div className="lg:w-2/5">
              <div className="lg:sticky lg:top-24 bg-white rounded-xl border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-[#D4AF37]" /> Order Summary
                </h3>
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    {item.type === 'session' ? (
                      <div className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #4c1d95 100%)' }}>
                        <span className="text-[6px] text-[#D4AF37] font-medium tracking-wider uppercase text-center leading-tight">Session</span>
                      </div>
                    ) : (
                      <img src={item.programImage} alt={item.programTitle}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=80'; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.programTitle}</p>
                      <p className="text-[10px] text-gray-500">{item.tierLabel} &middot; {item.participants.length} person{item.participants.length > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      {getItemOfferPrice(item) > 0 ? (
                        <><span className="text-[#D4AF37]">{symbol} {(getItemOfferPrice(item) * item.participants.length).toLocaleString()}</span>{' '}<span className="line-through text-gray-400 font-normal">{symbol} {(getItemPrice(item) * item.participants.length).toLocaleString()}</span></>
                      ) : `${symbol} ${(getItemPrice(item) * item.participants.length).toLocaleString()}`}
                    </span>
                  </div>
                ))}
                <div className="border-t mt-3 pt-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Subtotal</span><span>{symbol} {subtotal.toLocaleString()}</span>
                  </div>
                  {autoDiscounts.group_discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600" data-testid="discount-group">
                      <span>Group Discount ({totalParticipants} people)</span><span>-{symbol} {autoDiscounts.group_discount.toLocaleString()}</span>
                    </div>
                  )}
                  {autoDiscounts.combo_discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600" data-testid="discount-combo">
                      <span>Combo Discount ({numPrograms} programs)</span><span>-{symbol} {autoDiscounts.combo_discount.toLocaleString()}</span>
                    </div>
                  )}
                  {autoDiscounts.loyalty_discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600" data-testid="discount-loyalty">
                      <span>Loyalty Discount</span><span>-{symbol} {autoDiscounts.loyalty_discount.toLocaleString()}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Promo ({promoResult.code})</span><span>-{symbol} {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Total</span><span className="text-[#D4AF37]">{total <= 0 ? 'FREE' : `${symbol} ${total.toLocaleString()}`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Checkout Steps */}
            <div className="lg:w-3/5">
              {/* Step dots */}
              <div className="flex items-center gap-3 mb-6 justify-center">
                <StepDot active={step === 0} done={step > 0} /><div className={`w-12 h-0.5 ${step > 0 ? 'bg-green-500' : 'bg-gray-200'}`} />
                <StepDot active={step === 1} done={step > 1} /><div className={`w-12 h-0.5 ${step > 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
                <StepDot active={step === 2} done={false} />
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6">
                {/* Step 0: Review + Promo */}
                {step === 0 && (
                  <div data-testid="cart-step-review">
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Tag size={16} className="text-[#D4AF37]" /> Have a Promo Code?
                    </h2>
                    <div className="flex gap-2 mb-3">
                      <Input data-testid="cart-promo-input" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Enter promo code" className="text-sm flex-1" disabled={!!promoResult} />
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
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2 mb-4">
                        <Check size={14} className="text-green-600" />
                        <span className="text-xs text-green-700">{promoResult.message} — Saving {symbol} {discount.toLocaleString()}</span>
                      </div>
                    )}
                    <Button data-testid="cart-step0-next" onClick={() => setStep(1)}
                      className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-2">
                      Continue to Billing <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </div>
                )}

                {/* Step 1: Billing + Email OTP */}
                {step === 1 && (
                  <div data-testid="cart-step-billing">
                    {vpnDetected && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <ShieldAlert size={16} className="text-red-500 mt-0.5" />
                        <div><p className="text-red-800 text-xs font-semibold">VPN Detected</p><p className="text-red-600 text-[10px]">Regional pricing may not apply.</p></div>
                      </div>
                    )}
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CreditCard size={16} className="text-[#D4AF37]" /> Billing Details
                    </h2>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">Full Name *</label>
                          <Input data-testid="cart-booker-name" value={bookerName} onChange={e => setBookerName(e.target.value)} placeholder="Your name" className="text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">Email *</label>
                          <Input data-testid="cart-booker-email" type="email" value={bookerEmail} onChange={e => setBookerEmail(e.target.value)} placeholder="email@example.com" className="text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">Country *</label>
                          <select data-testid="cart-booker-country" value={bookerCountry} onChange={e => {
                            setBookerCountry(e.target.value);
                            const c = COUNTRIES.find(c => c.code === e.target.value);
                            if (c) setCountryCode(c.phone);
                          }} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
                            <option value="">Select country</option>
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">Phone</label>
                          <div className="flex gap-1">
                            <select value={countryCode} onChange={e => {
                              setCountryCode(e.target.value);
                              const c = COUNTRIES.find(c => c.phone === e.target.value);
                              if (c) setBookerCountry(c.code);
                            }} className="border rounded-md px-1 py-2 text-xs w-20 bg-white">
                              {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
                            </select>
                            <Input data-testid="cart-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone number" className="text-sm flex-1" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 mt-3" data-testid="cart-payment-disclaimer">
                        <p className="text-[10px] text-amber-800 italic leading-relaxed">{paymentSettings.disclaimer}</p>
                      </div>
                    )}

                    {!otpSent && !emailVerified && (
                      <Button data-testid="cart-send-otp" onClick={submitBookerAndSendOtp} disabled={loading}
                        className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-4">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Mail size={14} className="mr-2" /> Verify Email & Continue</>}
                      </Button>
                    )}

                    {otpSent && !emailVerified && (
                      <div className="border rounded-lg p-4 bg-gray-50 mt-4">
                        <p className="text-xs text-gray-600 mb-2">Enter the verification code sent to <strong>{bookerEmail}</strong></p>
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
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4 flex items-center gap-2">
                        <ShieldCheck size={14} className="text-green-600" />
                        <span className="text-xs text-green-700 font-medium">{bookerEmail} — Verified</span>
                      </div>
                    )}

                    <div className="flex gap-3 mt-3">
                      <Button variant="outline" onClick={() => setStep(0)} className="rounded-full">
                        <ChevronLeft size={16} /> Back
                      </Button>
                      {emailVerified && (
                        <Button data-testid="cart-step1-continue" onClick={() => setStep(2)} className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                          Continue to Payment <ChevronRight size={16} className="ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Confirm & Pay */}
                {step === 2 && (
                  <div data-testid="cart-step-pay">
                    {total <= 0 ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-green-600" /> Confirm Registration
                        </h2>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <p className="text-sm font-semibold text-green-700 mb-1">No payment required</p>
                          <p className="text-xs text-green-600">This enrollment is free. Click below to complete your registration.</p>
                        </div>
                      </>
                    ) : (
                      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-green-600" /> Confirm & Pay
                      </h2>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
                      <p><strong>Booked by:</strong> {bookerName}</p>
                      <p><strong>Email:</strong> {bookerEmail} <span className="text-green-600">Verified</span></p>
                      {phone && <p><strong>Phone:</strong> {countryCode}{phone}</p>}
                    </div>

                    <div className="space-y-2 mb-4">
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-700 py-1 border-b">
                          <span>{item.programTitle} ({item.tierLabel}) x{item.participants.length}</span>
                          <span className="font-medium">{symbol} {(getEffectivePrice(item) * item.participants.length).toLocaleString()}</span>
                        </div>
                      ))}
                      {discount > 0 && (
                        <div className="flex justify-between text-xs text-green-600"><span>Promo ({promoResult.code})</span><span>-{symbol} {discount.toLocaleString()}</span></div>
                      )}
                      {totalAutoDiscount > 0 && (
                        <div className="flex justify-between text-xs text-green-600"><span>Discounts</span><span>-{symbol} {totalAutoDiscount.toLocaleString()}</span></div>
                      )}
                    </div>

                    <div className="flex justify-between font-bold text-lg border-t pt-3 mb-5">
                      <span>Total</span><span className="text-[#D4AF37]">{total <= 0 ? 'FREE' : `${symbol} ${total.toLocaleString()}`}</span>
                    </div>

                    {/* India payment options — matching EnrollmentPage */}
                    {bookerCountry === 'IN' && paymentSettings.india_enabled && total > 0 && (
                      <div className="mb-4" data-testid="cart-india-payment-options">
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

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3" data-testid="cart-india-pricing-note">
                          <p className="text-[10px] text-amber-800 leading-relaxed">
                            <strong>Please note:</strong> Indian payment methods (UPI, GPay, bank transfer) may result in the total price being 12-15% higher due to additional processing and platform charges.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const params = new URLSearchParams({
                              program: items.map(i => i.programTitle).join(', '),
                              price: String(subtotal || 0),
                              promo_discount: String(discount || 0),
                              auto_discount: String(totalAutoDiscount || 0),
                            });
                            navigate(`/india-payment/${enrollmentId}?${params.toString()}`);
                          }}
                          className="flex items-center justify-between w-full border rounded-lg p-4 hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                          data-testid="cart-india-alt-payment-option">
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
                            onClick={() => navigate(`/manual-payment/${enrollmentId}`)}
                            className="flex items-center justify-between w-full border rounded-lg p-4 mt-2 hover:border-teal-400 hover:bg-teal-50/50 transition-all group"
                            data-testid="cart-manual-payment-option">
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
                      <Button variant="outline" onClick={() => setStep(1)} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="cart-pay-btn" onClick={handleCheckout} disabled={processing || (total > 0 && !enrollmentId)}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                        {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> {total <= 0 ? 'Registering...' : 'Redirecting...'}</> : total <= 0 ? <><Check size={14} className="mr-2" /> Complete Registration</> : <><Lock size={14} className="mr-2" /> Pay {symbol} {total.toLocaleString()}</>}
                      </Button>
                    </div>

                    {total > 0 && (
                      <>
                        {paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                          <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-lg p-3" data-testid="cart-payment-disclaimer-pay">
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

export default CartCheckoutPage;
