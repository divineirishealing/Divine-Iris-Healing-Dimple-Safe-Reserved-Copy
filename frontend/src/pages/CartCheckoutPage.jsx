import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ShieldCheck, ShieldAlert, ShoppingCart, FileText, Gift
} from 'lucide-react';
import MotivationalSignupFlash from '../components/MotivationalSignupFlash';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StepDot = ({ active, done }) => (
  <div className={`w-3 h-3 rounded-full transition-all ${done ? 'bg-green-500' : active ? 'bg-[#D4AF37] scale-110' : 'bg-gray-200'}`} />
);

function CartCheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { country: detectedCountry, symbol, baseCurrency, baseSymbol, displayCurrency, displaySymbol, isPrimary, getPrice, getOfferPrice, toDisplay } = useCurrency();
  const { toast } = useToast();
  const currency = baseCurrency;
  const [searchParams] = useSearchParams();

  // Enrollment ID and promo come from cart page via URL
  const [enrollmentId, setEnrollmentId] = useState(searchParams.get('eid') || null);
  const [promoCode] = useState(searchParams.get('promo') || '');
  const [promoResult, setPromoResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({ disclaimer: '', disclaimer_enabled: true, disclaimer_style: {}, india_links: [], india_exly_link: '', india_bank_details: {}, india_enabled: false, manual_form_enabled: true });
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const [pointsSummary, setPointsSummary] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Auto-derive booker from first participant
  const firstP = items[0]?.participants?.[0] || {};
  const bookerName = firstP.name || '';
  const bookerEmail = firstP.email || '';
  const bookerCountry = firstP.country || '';
  const bookerCity = firstP.city || '';
  const bookerState = firstP.state || '';
  const phone = firstP.phone || '';
  const countryCode = firstP.phone_code || '';

  useEffect(() => {
    if (items.length === 0) navigate('/cart');
    if (!enrollmentId) navigate('/cart');
  }, [items, navigate, enrollmentId]);

  // Validate promo on mount if provided
  useEffect(() => {
    if (promoCode && items.length > 0) {
      axios.post(`${API}/promotions/validate`, { code: promoCode, program_id: items[0]?.programId, currency })
        .then(r => setPromoResult(r.data)).catch(() => {});
    }
  }, [promoCode, currency]);

  // Fetch payment settings
  useEffect(() => {
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
  }, []);

  // Local price getters using active currency
  const getItemPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    const key = `price_${currency}`;
    const base = tier ? (tier[key] || 0) : (item[key] || 0);
    return toDisplay(base);
  };

  const getItemOfferPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    let base = 0;
    if (tier) base = tier[`offer_price_${currency}`] || tier[`offer_${currency}`] || 0;
    else if (currency === 'aed') base = item.offer_price_aed || 0;
    else if (currency === 'inr') base = item.offer_price_inr || 0;
    else if (currency === 'usd') base = item.offer_price_usd || 0;
    return toDisplay(base);
  };

  const getEffectivePrice = (item) => {
    const offer = getItemOfferPrice(item);
    return offer > 0 ? offer : getItemPrice(item);
  };

  const subtotal = items.reduce((sum, item) => sum + getEffectivePrice(item) * item.participants.length, 0);
  const totalParticipants = items.reduce((sum, i) => sum + i.participants.length, 0);
  const numPrograms = items.length;

  const cartProgramIdsForUrgency = useMemo(
    () =>
      [...new Set(items.filter((i) => i.type !== 'session').map((i) => String(i.programId).trim()).filter(Boolean))],
    [items],
  );

  const [autoDiscounts, setAutoDiscounts] = useState({ group_discount: 0, combo_discount: 0, loyalty_discount: 0, total_discount: 0 });

  useEffect(() => {
    if (subtotal <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: numPrograms, num_participants: totalParticipants,
          subtotal, email: bookerEmail, currency,
          program_ids: items.map(i => i.programId),
          cart_items: items.map(i => ({ program_id: i.programId, tier_index: i.tierIndex })),
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
  const totalAutoDiscount = (autoDiscounts.group_discount || 0) + (autoDiscounts.combo_discount || 0) + (autoDiscounts.loyalty_discount || 0);
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

  useEffect(() => {
    if (!enrollmentId || total <= 0) {
      setPointsSummary(null);
      return;
    }
    const cartProgramIds = items.map((i) => i.programId).filter(Boolean).join(',');
    const first = items[0];
    axios
      .get(`${API}/enrollment/${enrollmentId}/points-summary`, {
        params: {
          basket_subtotal: total,
          currency,
          item_type: first?.type === 'session' ? 'session' : 'program',
          item_id: first?.programId || '',
          cart_program_ids: cartProgramIds,
        },
      })
      .then((r) => {
        setPointsSummary(r.data);
        setPointsToRedeem(0);
      })
      .catch(() => setPointsSummary(null));
  }, [enrollmentId, total, currency, items]);

  const pointsCashEstimate = (() => {
    if (!pointsSummary?.enabled || !pointsToRedeem || total <= 0) return 0;
    const per = Number(pointsSummary.fiat_per_point) || 0;
    const pct = Number(pointsSummary.max_basket_pct) || 20;
    const maxCash = total * (pct / 100);
    const bal = Number(pointsSummary.balance) || 0;
    const maxByOrder = per > 0 ? Math.floor(maxCash / per) : 0;
    const cap = pointsSummary.max_points_usable != null
      ? Math.min(bal, pointsSummary.max_points_usable)
      : Math.min(bal, maxByOrder);
    const pts = Math.min(Math.max(0, parseInt(String(pointsToRedeem), 10) || 0), cap);
    const cash = Math.min(pts * per, maxCash, total);
    return Math.round(cash * 100) / 100;
  })();

  const displayCheckoutTotal =
    pointsSummary?.enabled && total > 0
      ? Math.max(0, Math.round((total - pointsCashEstimate) * 100) / 100)
      : total;

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const firstItem = items[0];
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId, item_type: firstItem.type === 'session' ? 'session' : 'program', item_id: firstItem.programId, currency,
        display_currency: displayCurrency, display_rate: isPrimary ? 1 : undefined,
        origin_url: window.location.origin, promo_code: promoResult?.code || null,
        tier_index: firstItem.tierIndex,
        points_to_redeem: pointsSummary?.enabled ? Math.max(0, parseInt(String(pointsToRedeem), 10) || 0) : 0,
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
                  {pointsSummary?.enabled && total > 0 && pointsCashEstimate > 0 && (
                    <div className="flex justify-between text-xs text-amber-700" data-testid="cart-points-discount">
                      <span>Points</span><span>-{symbol} {pointsCashEstimate.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-[#D4AF37]">{displayCheckoutTotal <= 0 ? 'FREE' : `${symbol} ${displayCheckoutTotal.toLocaleString()}`}</span>
                  </div>
                </div>
              </div>

              <MotivationalSignupFlash
                quotes={urgencyQuotes}
                programIds={cartProgramIdsForUrgency.length ? cartProgramIdsForUrgency : undefined}
                globalOnly={cartProgramIdsForUrgency.length === 0}
                className="mt-4"
              />
            </div>

            {/* Right: Payment */}
            <div className="lg:w-3/5">
              <div className="bg-white rounded-xl border shadow-sm p-6">
                {/* Confirm & Pay — only step */}
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
                      <span>Total</span>
                      <span className="text-[#D4AF37]">{displayCheckoutTotal <= 0 ? 'FREE' : `${symbol} ${displayCheckoutTotal.toLocaleString()}`}</span>
                    </div>

                    {pointsSummary?.enabled && total > 0 && pointsSummary.redeem_blocked && (
                      <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/60" data-testid="cart-points-flagship-block">
                        <p className="text-[10px] text-amber-900 flex items-center gap-1.5">
                          <Gift size={14} className="text-amber-700 shrink-0" />
                          {pointsSummary.redeem_blocked_reason || 'Points cannot be applied to this checkout.'}
                        </p>
                      </div>
                    )}
                    {pointsSummary?.enabled && total > 0 && (pointsSummary.max_points_usable || 0) > 0 && (
                      <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/40" data-testid="cart-points-box">
                        <p className="text-xs font-semibold text-gray-900 mb-0.5 flex items-center gap-1.5">
                          <Gift size={14} className="text-amber-600" /> Use points
                        </p>
                        <p className="text-[10px] text-gray-600 mb-2">
                          Balance <strong>{pointsSummary.balance}</strong> · Up to <strong>{pointsSummary.max_basket_pct}%</strong> of this order
                        </p>
                        <input
                          type="range"
                          min={0}
                          max={pointsSummary.max_points_usable || 0}
                          value={Math.min(pointsToRedeem, pointsSummary.max_points_usable || 0)}
                          onChange={(e) => setPointsToRedeem(parseInt(e.target.value, 10) || 0)}
                          className="w-full h-2 accent-amber-600"
                        />
                        <div className="flex justify-between text-[10px] text-gray-700 mt-1">
                          <span>{Math.min(pointsToRedeem, pointsSummary.max_points_usable || 0)} pts</span>
                          <span className="text-amber-800">-{symbol}{pointsCashEstimate.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* India payment options — matching EnrollmentPage */}
                    {detectedCountry === 'IN' && paymentSettings.india_enabled && total > 0 && (
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
                            window.history.replaceState(null, '', `/cart/checkout?eid=${enrollmentId}&promo=${promoCode || ''}`);
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
                            onClick={() => {
                              window.history.replaceState(null, '', `/cart/checkout?eid=${enrollmentId}&promo=${promoCode || ''}`);
                              navigate(`/manual-payment/${enrollmentId}`);
                            }}
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
                      <Button variant="outline" onClick={() => navigate('/cart')} className="rounded-full"><ChevronLeft size={16} /></Button>
                      <Button data-testid="cart-pay-btn" onClick={handleCheckout} disabled={processing || (total > 0 && !enrollmentId)}
                        className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full">
                        {processing ? <><Loader2 className="animate-spin mr-2" size={16} /> {displayCheckoutTotal <= 0 ? 'Registering...' : 'Redirecting...'}</> : displayCheckoutTotal <= 0 ? <><Check size={14} className="mr-2" /> Complete Registration</> : <><Lock size={14} className="mr-2" /> Pay {symbol} {displayCheckoutTotal.toLocaleString()}</>}
                      </Button>
                    </div>

                    {total > 0 && (
                      <>
                        {paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                          <div className="mt-3 rounded-xl p-4 border-2 shadow-sm" data-testid="cart-payment-disclaimer-pay"
                            style={{ backgroundColor: paymentSettings.disclaimer_style?.bg_color || '#fef2f2', borderColor: paymentSettings.disclaimer_style?.border_color || '#f87171' }}>
                            <p style={{ fontSize: paymentSettings.disclaimer_style?.font_size || '14px', fontWeight: paymentSettings.disclaimer_style?.font_weight || '600', color: paymentSettings.disclaimer_style?.font_color || '#991b1b', lineHeight: '1.5' }}>
                              {paymentSettings.disclaimer.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
                                }
                                return part;
                              })}
                            </p>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 mt-3 text-center flex items-center justify-center gap-1"><Lock size={10} /> Secure payment via Stripe</p>
                      </>
                    )}
                  </div>
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
