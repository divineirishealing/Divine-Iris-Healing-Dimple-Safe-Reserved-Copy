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
  Tag, CreditCard, Phone, Lock, Loader2, Check, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, ShoppingCart
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
  const { getPrice, getOfferPrice, symbol, currency, country: detectedCountry } = useCurrency();
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
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [mockOtp, setMockOtp] = useState('');
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [processing, setProcessing] = useState(false);

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

  const getItemPrice = (item) => {
    const fakeProgram = { is_flagship: item.isFlagship, duration_tiers: item.durationTiers || [], price_aed: item.price_aed, price_inr: item.price_inr, price_usd: item.price_usd };
    return getPrice(fakeProgram, item.tierIndex);
  };

  const getItemOfferPrice = (item) => {
    const fakeProgram = { is_flagship: item.isFlagship, duration_tiers: item.durationTiers || [], offer_price_aed: item.offer_price_aed, offer_price_inr: item.offer_price_inr, offer_price_usd: item.offer_price_usd };
    return getOfferPrice(fakeProgram, item.tierIndex);
  };

  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    return offer > 0 ? offer : getItemPrice(item);
  };

  const subtotal = items.reduce((sum, item) => sum + getEffectivePrice(item) * item.participants.length, 0);
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  const numPrograms = items.length;

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  // Fetch auto-discounts whenever subtotal, participants, or email changes
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
    if (!bookerEmail.trim()) return toast({ title: 'Enter your email', variant: 'destructive' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookerEmail)) return toast({ title: 'Enter valid email', variant: 'destructive' });
    if (!phone.trim() || phone.length < 7) return toast({ title: 'Enter valid phone', variant: 'destructive' });

    setLoading(true);
    try {
      // Use first cart item's program for enrollment
      const firstItem = items[0];
      const allParticipants = items.flatMap(item =>
        item.participants.map(p => ({
          name: p.name, relationship: p.relationship, age: parseInt(p.age),
          gender: p.gender, country: p.country, attendance_mode: p.attendance_mode,
          notify: p.notify, email: p.email || null, phone: p.phone || null,
          whatsapp: p.whatsapp || null,
          program_id: item.programId, program_title: item.programTitle,
          is_first_time: p.is_first_time || false, referral_source: p.referral_source || '',
          referred_by_name: p.has_referral ? (p.referred_by_name || '') : '',
        }))
      );

      const enrollRes = await axios.post(`${API}/enrollment/start`, {
        booker_name: bookerName, booker_email: bookerEmail, booker_country: bookerCountry,
        participants: allParticipants,
      });
      setEnrollmentId(enrollRes.data.enrollment_id);
      setVpnDetected(enrollRes.data.vpn_detected);

      const otpRes = await axios.post(`${API}/enrollment/${enrollRes.data.enrollment_id}/send-otp`, { phone, country_code: countryCode });
      setOtpSent(true);
      if (otpRes.data.mock_otp) setMockOtp(otpRes.data.mock_otp);
      toast({ title: 'OTP Sent!' });
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
      setStep(2);
    } catch (err) {
      toast({ title: 'Wrong OTP', variant: 'destructive' });
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
      });
      clearCart();
      window.location.href = res.data.url;
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
                    <span>Total</span><span className="text-[#D4AF37]">{symbol} {total.toLocaleString()}</span>
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

                {/* Step 1: Billing + OTP */}
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
                          <select data-testid="cart-booker-country" value={bookerCountry} onChange={e => setBookerCountry(e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm bg-white">
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">Phone *</label>
                          <div className="flex gap-1">
                            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="border rounded-md px-1 py-2 text-xs w-20 bg-white">
                              {COUNTRIES.map(c => <option key={c.code} value={c.phone}>{c.phone}</option>)}
                            </select>
                            <Input data-testid="cart-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone" className="text-sm flex-1" disabled={otpSent} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {!otpSent && !phoneVerified && (
                      <Button data-testid="cart-send-otp" onClick={submitBookerAndSendOtp} disabled={loading}
                        className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full mt-4">
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Phone size={14} className="mr-2" /> Verify & Continue</>}
                      </Button>
                    )}

                    {otpSent && !phoneVerified && (
                      <div className="border rounded-lg p-4 bg-gray-50 mt-4">
                        <p className="text-xs text-gray-600 mb-2">Enter OTP sent to {countryCode}{phone}</p>
                        <div className="flex gap-2">
                          <Input data-testid="cart-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter OTP" maxLength={6}
                            className="flex-1 text-center tracking-[0.5em] font-mono text-lg" />
                          <Button data-testid="cart-verify-otp" onClick={verifyOtp} disabled={loading || otp.length !== 6}
                            className="bg-[#D4AF37] hover:bg-[#b8962e] text-white">
                            {loading ? <Loader2 className="animate-spin" size={14} /> : 'Verify'}
                          </Button>
                        </div>
                        {mockOtp && (
                          <p data-testid="cart-mock-otp" className="text-xs text-orange-500 mt-2 bg-orange-50 p-2 rounded text-center">
                            Test OTP: <strong className="font-mono">{mockOtp}</strong>
                          </p>
                        )}
                      </div>
                    )}

                    <Button variant="outline" onClick={() => setStep(0)} className="mt-3 rounded-full">
                      <ChevronLeft size={16} /> Back
                    </Button>
                  </div>
                )}

                {/* Step 2: Confirm & Pay */}
                {step === 2 && (
                  <div data-testid="cart-step-pay">
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-600" /> Confirm & Pay
                    </h2>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
                      <p><strong>Booked by:</strong> {bookerName}</p>
                      <p><strong>Email:</strong> {bookerEmail}</p>
                      <p><strong>Phone:</strong> {countryCode}{phone} <span className="text-green-600">Verified</span></p>
                    </div>

                    <div className="space-y-2 mb-4">
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-700 py-1 border-b">
                          <span>{item.programTitle} ({item.tierLabel}) x{item.participants.length}</span>
                          <span className="font-medium">{symbol} {(getItemPrice(item) * item.participants.length).toLocaleString()}</span>
                        </div>
                      ))}
                      {discount > 0 && (
                        <div className="flex justify-between text-xs text-green-600"><span>Promo ({promoResult.code})</span><span>-{symbol} {discount.toLocaleString()}</span></div>
                      )}
                    </div>

                    <div className="flex justify-between font-bold text-lg border-t pt-3 mb-5">
                      <span>Total</span><span className="text-[#D4AF37]">{symbol} {total.toLocaleString()}</span>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="cart-pay-btn" onClick={handleCheckout} disabled={processing || total <= 0}
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

export default CartCheckoutPage;
