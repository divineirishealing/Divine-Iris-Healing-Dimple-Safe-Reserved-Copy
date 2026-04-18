import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../hooks/use-toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Tag,
  CreditCard,
  Lock,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Users,
  Gift,
} from 'lucide-react';
import MotivationalSignupFlash from '../components/MotivationalSignupFlash';
import { getAuthHeaders } from '../lib/authHeaders';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PORTAL_CHECKOUT_PATH = '/dashboard/combined-checkout';

function combinedAttendanceLabel(p) {
  if (p.attendance_mode === 'online') return 'Online (Zoom)';
  if (p.attendance_mode === 'in_person') return 'In person';
  return 'Offline / remote';
}

function combinedNotifyLabel(p) {
  if (p.attendance_mode === 'online') return 'On (Zoom)';
  return p.notify ? 'On' : 'Off';
}

const PAYMENT_METHOD_BADGES = {
  stripe: { label: 'Stripe · card', className: 'bg-violet-100/90 text-violet-900 border-violet-200/80' },
  gpay: { label: 'GPay / UPI', className: 'bg-emerald-100/90 text-emerald-900 border-emerald-200/80' },
  bank: { label: 'Bank transfer', className: 'bg-slate-100/90 text-slate-800 border-slate-200/80' },
  manual: { label: 'Manual · proof upload', className: 'bg-amber-100/90 text-amber-950 border-amber-200/80' },
};

function PaymentMethodTags({ methods }) {
  const list = Array.isArray(methods) && methods.length > 0 ? methods : ['stripe'];
  return (
    <div className="flex flex-wrap gap-2" data-testid="dashboard-combined-payment-tags">
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 w-full">Your enabled methods</span>
      {list.map((key) => {
        const raw = String(key || '').toLowerCase().trim();
        const def = PAYMENT_METHOD_BADGES[raw] || {
          label: raw || '—',
          className: 'bg-white/80 text-slate-700 border-slate-200',
        };
        return (
          <span
            key={raw}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${def.className}`}
          >
            {def.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Portal Review & pay: same enrollment + Stripe / India / manual flows as main-site checkout,
 * Logged-in portal flow skips email OTP; uses membership payment_methods from /api/student/home.
 */
export default function DashboardCombinedCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, clearCart } = useCart();
  const {
    country: detectedCountry,
    symbol,
    baseCurrency,
    displayCurrency,
    isPrimary,
    toDisplay,
  } = useCurrency();
  const { toast } = useToast();
  const currency = baseCurrency;

  const eidParam = searchParams.get('eid');
  const [enrollmentId, setEnrollmentId] = useState(eidParam);
  const [promoCode, setPromoCode] = useState(() => searchParams.get('promo') || '');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    disclaimer: '',
    disclaimer_enabled: true,
    disclaimer_style: {},
    india_enabled: false,
    manual_form_enabled: true,
  });
  const [checkoutPromoVisible, setCheckoutPromoVisible] = useState(null);
  const [urgencyQuotes, setUrgencyQuotes] = useState([]);
  const [pointsSummary, setPointsSummary] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState(['stripe']);
  const [enrollmentSubmitLoading, setEnrollmentSubmitLoading] = useState(false);
  const promoFromUrlApplied = useRef(false);

  useEffect(() => {
    if (eidParam && eidParam !== enrollmentId) setEnrollmentId(eidParam);
  }, [eidParam, enrollmentId]);

  const firstP = items[0]?.participants?.[0] || {};
  const bookerName = firstP.name || '';
  const bookerEmail = firstP.email || '';
  const bookerCountry = firstP.country || '';
  const bookerCity = firstP.city || '';
  const bookerState = firstP.state || '';
  const phone = firstP.phone || '';
  const countryCode = firstP.phone_code || '';

  useEffect(() => {
    axios.get(`${API}/student/home`, { withCredentials: true })
      .then((r) => {
        const pm = r.data?.payment_methods;
        if (Array.isArray(pm) && pm.length) setPaymentMethods(pm);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      toast({ title: 'Nothing to review', description: 'Add programs from your dashboard, then return here.' });
      navigate('/dashboard');
    }
  }, [items.length, navigate, toast]);

  useEffect(() => {
    axios.get(`${API}/settings`)
      .then((r) => {
        const s = r.data;
        setPaymentSettings({
          disclaimer: s.payment_disclaimer || '',
          disclaimer_enabled: s.payment_disclaimer_enabled !== false,
          disclaimer_style: s.payment_disclaimer_style || {},
          india_enabled: s.india_payment_enabled || false,
          manual_form_enabled: s.manual_form_enabled !== false,
        });
        setUrgencyQuotes(s.enrollment_urgency_quotes || []);
        setCheckoutPromoVisible(s.checkout_promo_code_visible !== false);
      })
      .catch(() => {
        setCheckoutPromoVisible(true);
      });
  }, []);

  const getItemPrice = (item) => {
    const tiers = item.durationTiers || [];
    const hasTiers = item.isFlagship && tiers.length > 0;
    const tier = hasTiers ? tiers[item.tierIndex] : null;
    const key = `price_${currency}`;
    const base = tier ? tier[key] || 0 : item[key] || 0;
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

  const [autoDiscounts, setAutoDiscounts] = useState({
    group_discount: 0,
    combo_discount: 0,
    loyalty_discount: 0,
    total_discount: 0,
  });

  useEffect(() => {
    if (subtotal <= 0) return;
    const fetchDiscounts = async () => {
      try {
        const res = await axios.post(`${API}/discounts/calculate`, {
          num_programs: numPrograms,
          num_participants: totalParticipants,
          subtotal,
          email: bookerEmail,
          currency,
          program_ids: items.map((i) => i.programId),
          cart_items: items.map((i) => ({ program_id: i.programId, tier_index: i.tierIndex })),
        });
        setAutoDiscounts(res.data);
      } catch {
        setAutoDiscounts({
          group_discount: 0,
          combo_discount: 0,
          loyalty_discount: 0,
          total_discount: 0,
        });
      }
    };
    const timer = setTimeout(fetchDiscounts, 300);
    return () => clearTimeout(timer);
  }, [subtotal, totalParticipants, numPrograms, bookerEmail, currency, items]);

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await axios.post(`${API}/promotions/validate`, {
        code: promoCode.trim(),
        program_id: items[0]?.programId,
        currency,
      });
      setPromoResult(res.data);
      toast({ title: res.data.message });
    } catch {
      setPromoResult(null);
      toast({ title: 'Invalid Code', variant: 'destructive' });
    } finally {
      setPromoLoading(false);
    }
  };

  const discount = (() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === 'percentage')
      return Math.round(subtotal * promoResult.discount_percentage / 100);
    return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
  })();
  const totalAutoDiscount =
    (autoDiscounts.group_discount || 0) +
    (autoDiscounts.combo_discount || 0) +
    (autoDiscounts.loyalty_discount || 0);
  const total = Math.max(0, subtotal - discount - totalAutoDiscount);

  useEffect(() => {
    if (promoFromUrlApplied.current || checkoutPromoVisible !== true || items.length === 0) return;
    const code = searchParams.get('promo');
    if (!code?.trim()) return;
    promoFromUrlApplied.current = true;
    axios
      .post(`${API}/promotions/validate`, {
        code: code.trim(),
        program_id: items[0]?.programId,
        currency,
      })
      .then((r) => {
        setPromoResult(r.data);
        setPromoCode(code.trim().toUpperCase());
      })
      .catch(() => {});
  }, [checkoutPromoVisible, items.length, items, currency, searchParams]);

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
    const cap =
      pointsSummary.max_points_usable != null
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

  const validateAndProceed = useCallback(() => {
    for (const item of items) {
      for (let i = 0; i < item.participants.length; i++) {
        const p = item.participants[i];
        if (!p.name.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs a name`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.relationship) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs relationship`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.age || parseInt(p.age, 10) < 5) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs valid age (5+)`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.gender) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs gender`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.country) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs country`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.city || !p.city.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs city`,
            variant: 'destructive',
          });
          return false;
        }
        if (!p.state || !p.state.trim()) {
          toast({
            title: `${item.programTitle}: Participant ${i + 1} needs state`,
            variant: 'destructive',
          });
          return false;
        }
        if (p.notify || p.attendance_mode === 'online') {
          if (!p.email || !p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
            toast({
              title: `${item.programTitle}: Participant ${i + 1} needs a valid email`,
              variant: 'destructive',
            });
            return false;
          }
          if (!p.phone || !p.phone.trim()) {
            toast({
              title: `${item.programTitle}: Participant ${i + 1} needs a phone number`,
              variant: 'destructive',
            });
            return false;
          }
        }
      }
    }
    return true;
  }, [items, toast]);

  const startTrustedEnrollment = async () => {
    if (!validateAndProceed()) return;
    if (!bookerEmail) {
      toast({ title: 'Booker email is required', variant: 'destructive' });
      return;
    }
    setEnrollmentSubmitLoading(true);
    try {
      const bookerPhone = phone ? `${countryCode}${phone}` : null;
      const allParticipants = items.flatMap((item) =>
        item.participants.map((p) => {
          const refName = p.has_referral
            ? p.referred_by_name || ''
            : p.referral_source === 'Friend / Family'
              ? p.referred_by_name || ''
              : '';
          const refEmailRaw = (p.referred_by_email || '').trim().toLowerCase();
          const refEmail =
            (p.has_referral || p.referral_source === 'Friend / Family') && refEmailRaw ? refEmailRaw : null;
          return {
            name: p.name,
            relationship: p.relationship,
            age: parseInt(p.age, 10),
            gender: p.gender,
            country: p.country,
            city: p.city,
            state: p.state,
            attendance_mode: p.attendance_mode,
            notify: p.notify,
            email: p.email || null,
            phone: p.notify && p.phone ? `${p.phone_code || ''}${p.phone}` : null,
            whatsapp: p.whatsapp ? `${p.wa_code || ''}${p.whatsapp}` : null,
            program_id: item.programId,
            program_title: item.programTitle,
            is_first_time: p.is_first_time || false,
            referral_source: p.referral_source || '',
            referred_by_name: refName,
            referred_by_email: refEmail,
          };
        }),
      );

      const leadItem = items[0];
      const enrollRes = await axios.post(
        `${API}/student/combined-enrollment-start`,
        {
          booker_name: bookerName,
          booker_email: bookerEmail,
          booker_country: bookerCountry,
          item_type: leadItem?.type === 'session' ? 'session' : 'program',
          item_id: leadItem?.programId || '',
          item_title: leadItem?.programTitle || '',
          participants: allParticipants,
        },
        { withCredentials: true, headers: getAuthHeaders() },
      );
      const eid = enrollRes.data.enrollment_id;
      setEnrollmentId(eid);
      if (bookerPhone) {
        await axios.patch(`${API}/enrollment/${eid}/update-phone`, { phone: bookerPhone }).catch(() => {});
      }
      toast({ title: enrollRes.data.message || 'Ready for payment' });
      const next = new URLSearchParams();
      next.set('eid', eid);
      if (promoResult?.code) next.set('promo', promoResult.code);
      else if (promoCode) next.set('promo', promoCode);
      setSearchParams(next, { replace: true });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.detail || 'Failed',
        variant: 'destructive',
      });
    } finally {
      setEnrollmentSubmitLoading(false);
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const firstItem = items[0];
      const res = await axios.post(`${API}/enrollment/${enrollmentId}/checkout`, {
        enrollment_id: enrollmentId,
        item_type: firstItem.type === 'session' ? 'session' : 'program',
        item_id: firstItem.programId,
        currency,
        display_currency: displayCurrency,
        display_rate: isPrimary ? 1 : undefined,
        origin_url: window.location.origin,
        promo_code: promoResult?.code || null,
        tier_index: firstItem.tierIndex,
        points_to_redeem:
          pointsSummary?.enabled ? Math.max(0, parseInt(String(pointsToRedeem), 10) || 0) : 0,
        cart_items: items.map((i) => ({
          program_id: i.programId,
          tier_index: i.tierIndex,
          participants_count: i.participants.length,
        })),
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
      toast({
        title: 'Payment Error',
        description: err.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const portalReturnQs = useMemo(() => {
    const q = new URLSearchParams();
    if (enrollmentId) q.set('eid', enrollmentId);
    if (promoResult?.code) q.set('promo', promoResult.code);
    else if (promoCode) q.set('promo', promoCode);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [enrollmentId, promoResult?.code, promoCode]);

  const rosterRows = useMemo(
    () =>
      items.flatMap((item) =>
        (item.participants || []).map((p, idx) => ({
          item,
          p,
          idx,
          key: `${item.id}-${idx}`,
        })),
      ),
    [items],
  );

  const rosterParticipantCount = rosterRows.length;

  if (items.length === 0) return null;

  const hasStripe = paymentMethods.map((x) => String(x).toLowerCase()).includes('stripe');

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white drop-shadow-sm" data-testid="dashboard-combined-title">
            Review &amp; pay — combined order
          </h1>
          <p className="text-xs text-violet-100/90 mt-1 max-w-xl">
            Every seat you added from the dashboard is listed below. Payment options follow the methods enabled for your
            membership.
          </p>
          <div className="mt-3 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2.5">
            <PaymentMethodTags methods={paymentMethods} />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/30 bg-white/10 text-white hover:bg-white/20 shrink-0"
          onClick={() => navigate('/dashboard')}
        >
          <ChevronLeft size={16} className="mr-1" /> Back to dashboard
        </Button>
      </div>

      <div className="bg-white/95 backdrop-blur rounded-xl border border-[rgba(212,175,55,0.35)] shadow-lg p-4 sm:p-5 mb-6 w-full">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#D4AF37] mb-3">
          At a glance — who is enrolling
        </p>
        <p className="text-[10px] text-gray-500 mb-3" data-testid="dashboard-combined-roster-count">
          <strong className="text-gray-700">{rosterParticipantCount}</strong> seat          {rosterParticipantCount !== 1 ? 's' : ''} across <strong className="text-gray-700">{items.length}</strong> program
          {items.length !== 1 ? 's' : ''}. Adjust guests on the dashboard, remove a line item here if needed, then continue
          below.
        </p>
        <div className="space-y-0 divide-y divide-gray-100" data-testid="dashboard-combined-roster-table">
          {rosterRows.map((row, n) => {
            const { item, p, idx, key } = row;
            const name = String(p.name || '').trim() || `Seat ${idx + 1}`;
            const role = String(p.relationship || '').trim() || '—';
            const notify = combinedNotifyLabel(p);
            return (
              <div
                key={key}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 py-3 text-[11px] sm:text-xs text-gray-900 leading-snug"
              >
                <div className="sm:col-span-1 text-gray-500 tabular-nums font-medium">{n + 1}</div>
                <div className="sm:col-span-4 min-w-0 break-words">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wide sm:hidden">Program · </span>
                  <span className="font-medium text-gray-900">{item.programTitle}</span>
                </div>
                <div className="sm:col-span-2 min-w-0 break-words">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wide sm:hidden">Name · </span>
                  {name}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wide sm:hidden">Role · </span>
                  {role}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wide sm:hidden">Attendance · </span>
                  {combinedAttendanceLabel(p)}
                </div>
                <div className="sm:col-span-1 min-w-0 break-words text-gray-700">
                  <span className="text-gray-500 text-[10px] uppercase tracking-wide sm:hidden">Notify · </span>
                  {notify}
                </div>
              </div>
            );
          })}
        </div>
        {items.some((it) => (it.participants || []).length === 0) ? (
          <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-3">
            A line item has no participant rows. Remove it from your order or re-add the program from your dashboard.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/5 space-y-4">
          <div className="bg-white/95 backdrop-blur rounded-xl border border-white/40 shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users size={16} className="text-[#D4AF37]" /> Order summary
            </h3>
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0 border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 break-words">{item.programTitle}</p>
                  <p className="text-[10px] text-gray-500">
                    {item.tierLabel} · {item.participants.length} seat{item.participants.length > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-900">
                  {getItemOfferPrice(item) > 0 ? (
                    <>
                      <span className="text-[#D4AF37]">
                        {symbol} {(getItemOfferPrice(item) * item.participants.length).toLocaleString()}
                      </span>{' '}
                      <span className="line-through text-gray-400 font-normal">
                        {symbol} {(getItemPrice(item) * item.participants.length).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    `${symbol} ${(getItemPrice(item) * item.participants.length).toLocaleString()}`
                  )}
                </span>
              </div>
            ))}
            <div className="border-t mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Subtotal</span>
                <span>
                  {symbol} {subtotal.toLocaleString()}
                </span>
              </div>
              {autoDiscounts.group_discount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Group ({totalParticipants} people)</span>
                  <span>
                    -{symbol} {autoDiscounts.group_discount.toLocaleString()}
                  </span>
                </div>
              )}
              {autoDiscounts.combo_discount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Combo ({numPrograms} programs)</span>
                  <span>
                    -{symbol} {autoDiscounts.combo_discount.toLocaleString()}
                  </span>
                </div>
              )}
              {autoDiscounts.loyalty_discount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Loyalty</span>
                  <span>
                    -{symbol} {autoDiscounts.loyalty_discount.toLocaleString()}
                  </span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Promo ({promoResult?.code})</span>
                  <span>
                    -{symbol} {discount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>Total</span>
                <span className="text-[#D4AF37]">
                  {displayCheckoutTotal <= 0 ? 'FREE' : `${symbol} ${displayCheckoutTotal.toLocaleString()}`}
                </span>
              </div>
            </div>
          </div>

          <MotivationalSignupFlash
            quotes={urgencyQuotes}
            programIds={cartProgramIdsForUrgency.length ? cartProgramIdsForUrgency : undefined}
            globalOnly={cartProgramIdsForUrgency.length === 0}
          />
        </div>

        <div className="lg:w-3/5 space-y-4">
          <div className="bg-white/95 backdrop-blur rounded-xl border border-white/40 shadow-lg p-6">
            {checkoutPromoVisible && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <label className="text-xs font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                  <Tag size={12} className="text-[#D4AF37]" /> Promo code
                </label>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="text-sm flex-1"
                    disabled={!!promoResult}
                  />
                  {promoResult ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPromoResult(null);
                        setPromoCode('');
                      }}
                      className="text-xs"
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={validatePromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className="bg-[#D4AF37] hover:bg-[#b8962e] text-white text-xs"
                    >
                      {promoLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
                    </Button>
                  )}
                </div>
                {promoResult && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-1">
                    <Check size={12} className="text-green-600" />
                    <span className="text-xs text-green-700">{promoResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {!enrollmentId ? (
              <div data-testid="dashboard-combined-verify">
                <h2 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#D4AF37]" /> Continue to payment
                </h2>
                <p className="text-[10px] text-gray-500 mb-3">
                  Confirm the roster at left, then continue. Your portal login replaces email verification for this checkout.
                </p>
                <Button
                  onClick={startTrustedEnrollment}
                  disabled={enrollmentSubmitLoading}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full"
                >
                  {enrollmentSubmitLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      <ChevronRight size={14} className="mr-2" /> Save enrollment &amp; show payment options
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div data-testid="dashboard-combined-pay">
                {total <= 0 ? (
                  <>
                    <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-600" /> Confirm registration
                    </h2>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-green-700 mb-1">No payment required</p>
                      <p className="text-xs text-green-600">Complete registration for all items below.</p>
                    </div>
                  </>
                ) : (
                  <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-green-600" /> Confirm &amp; pay
                  </h2>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-xs text-gray-600 space-y-1">
                  <p>
                    <strong>Booked by:</strong> {bookerName}
                  </p>
                  <p>
                    <strong>Email:</strong> {bookerEmail}{' '}
                    <span className="text-slate-500 font-medium">(portal account)</span>
                  </p>
                  {phone && (
                    <p>
                      <strong>Phone:</strong> {countryCode}
                      {phone}
                    </p>
                  )}
                </div>

                {total > 0 && !hasStripe && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-950 leading-snug">
                    {detectedCountry === 'IN' && paymentSettings.india_enabled ? (
                      <p>
                        <strong>Stripe is off</strong> for your account. Use the India (Exly) or manual proof flow below — aligned
                        with your GPay / bank tags.
                      </p>
                    ) : (
                      <p>
                        <strong>Stripe is off</strong> for your account. Ask your admin to enable a payment method, or complete
                        payment through an India/manual flow if available.
                      </p>
                    )}
                  </div>
                )}

                {pointsSummary?.enabled && total > 0 && pointsSummary.redeem_blocked && (
                  <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/60">
                    <p className="text-[10px] text-amber-900 flex items-center gap-1.5">
                      <Gift size={14} className="text-amber-700 shrink-0" />
                      {pointsSummary.redeem_blocked_reason || 'Points cannot be applied to this checkout.'}
                    </p>
                  </div>
                )}
                {pointsSummary?.enabled && total > 0 && (pointsSummary.max_points_usable || 0) > 0 && (
                  <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50/40">
                    <p className="text-xs font-semibold text-gray-900 mb-0.5 flex items-center gap-1.5">
                      <Gift size={14} className="text-amber-600" /> Use points
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
                      <span className="text-amber-800">
                        -{symbol}
                        {pointsCashEstimate.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {detectedCountry === 'IN' && paymentSettings.india_enabled && total > 0 && (
                  <div className="mb-4" data-testid="dashboard-combined-india">
                    <div className="border-2 border-[#D4AF37] rounded-lg p-4 mb-3 bg-[#D4AF37]/5">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CreditCard size={16} className="text-[#D4AF37]" />
                        <span className="text-sm font-semibold text-gray-900">Pay with card (Stripe)</span>
                        {hasStripe ? (
                          <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            Enabled for you
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            Not on your account — use manual / India options
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600">
                        International card payment when Stripe is enabled for your membership.
                      </p>
                    </div>
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-[10px] text-gray-400 uppercase">India options</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.history.replaceState(null, '', `${PORTAL_CHECKOUT_PATH}${portalReturnQs}`);
                        const params = new URLSearchParams({
                          program: items.map((i) => i.programTitle).join(', '),
                          price: String(subtotal || 0),
                          promo_discount: String(discount || 0),
                          auto_discount: String(totalAutoDiscount || 0),
                        });
                        navigate(`/india-payment/${enrollmentId}?${params.toString()}`);
                      }}
                      className="flex items-center justify-between w-full border rounded-lg p-4 hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <CreditCard size={14} className="text-purple-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                            Exly / bank transfer
                          </span>
                          <p className="text-[10px] text-gray-500">GPay, cards, NEFT</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-600" />
                    </button>
                    {paymentSettings.manual_form_enabled && (
                      <button
                        type="button"
                        onClick={() => {
                          window.history.replaceState(null, '', `${PORTAL_CHECKOUT_PATH}${portalReturnQs}`);
                          navigate(`/manual-payment/${enrollmentId}`);
                        }}
                        className="flex items-center justify-between w-full border rounded-lg p-4 mt-2 hover:border-teal-400 hover:bg-teal-50/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                            <FileText size={14} className="text-teal-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 group-hover:text-teal-600">
                              Manual payment · proof upload
                            </span>
                            <p className="text-[10px] text-teal-600 font-medium">Aligned with GPay / bank on your account</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-teal-600" />
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-full">
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    data-testid="dashboard-combined-stripe-pay"
                    onClick={handleCheckout}
                    disabled={processing || (total > 0 && !enrollmentId) || (total > 0 && !hasStripe)}
                    className="flex-1 bg-[#D4AF37] hover:bg-[#b8962e] text-white py-3 rounded-full disabled:opacity-50"
                    title={
                      total > 0 && !hasStripe
                        ? 'Stripe is not enabled on your account — use India / manual options if shown, or contact support.'
                        : undefined
                    }
                  >
                    {processing ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />{' '}
                        {displayCheckoutTotal <= 0 ? 'Registering…' : 'Redirecting…'}
                      </>
                    ) : displayCheckoutTotal <= 0 ? (
                      <>
                        <Check size={14} className="mr-2" /> Complete registration
                      </>
                    ) : (
                      <>
                        <Lock size={14} className="mr-2" /> Pay {symbol} {displayCheckoutTotal.toLocaleString()} (Stripe)
                      </>
                    )}
                  </Button>
                </div>

                {total > 0 && paymentSettings.disclaimer_enabled && paymentSettings.disclaimer && (
                  <div
                    className="mt-3 rounded-xl p-4 border-2 shadow-sm"
                    style={{
                      backgroundColor: paymentSettings.disclaimer_style?.bg_color || '#fef2f2',
                      borderColor: paymentSettings.disclaimer_style?.border_color || '#f87171',
                    }}
                  >
                    <p
                      style={{
                        fontSize: paymentSettings.disclaimer_style?.font_size || '14px',
                        fontWeight: paymentSettings.disclaimer_style?.font_weight || '600',
                        color: paymentSettings.disclaimer_style?.font_color || '#991b1b',
                        lineHeight: '1.5',
                      }}
                    >
                      {paymentSettings.disclaimer.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={i} style={{ fontWeight: 800 }}>
                              {part.slice(2, -2)}
                            </strong>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
