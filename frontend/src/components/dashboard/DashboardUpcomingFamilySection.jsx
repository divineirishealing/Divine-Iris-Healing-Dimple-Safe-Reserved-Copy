import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Sparkles, Users, Tag, ArrowRight, Loader2, Plus, Trash2, CreditCard } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { resolveImageUrl } from '../../lib/imageUtils';
import { cn, formatDateDdMonYyyy } from '../../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];

/** Tier index for flagship programs: prefer annual tier for annual subscribers, else first tier. */
function pickTierIndexForDashboard(program, preferAnnualTier) {
  const tiers = program?.duration_tiers || [];
  if (!program?.is_flagship || tiers.length === 0) return null;
  if (preferAnnualTier) {
    const idx = tiers.findIndex((t) => {
      const l = (t.label || '').toLowerCase();
      return l.includes('annual') || l.includes('year') || t.duration_unit === 'year';
    });
    if (idx >= 0) return idx;
  }
  return 0;
}

/** Direct enrollment from dashboard (member pricing + profile prefill; skips public program page). */
function buildDashboardEnrollHref(p, { tierIdx, promoCode }) {
  const q = new URLSearchParams();
  q.set('source', 'dashboard');
  if (tierIdx !== null && tierIdx !== undefined) q.set('tier', String(tierIdx));
  if (promoCode && String(promoCode).trim()) q.set('promo', String(promoCode).trim());
  return `/enroll/program/${p.id}?${q.toString()}`;
}

function programStartLabel(p) {
  const d = p.start_date || p.deadline_date;
  if (!d) return 'Dates TBC';
  const iso = String(d).slice(0, 10);
  return formatDateDdMonYyyy(iso) || d;
}

/** MMM / AWRP etc. — already in annual package; member only pays for family add-ons. */
function programIncludedInAnnualPackage(p, configuredIds) {
  const ids = Array.isArray(configuredIds)
    ? configuredIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (ids.length > 0) {
    return ids.includes(String(p.id));
  }
  const t = `${p.title || ''} ${p.category || ''}`.toLowerCase();
  return (
    t.includes('money magic') ||
    t.includes('mmm') ||
    t.includes('atomic weight') ||
    t.includes('awrp')
  );
}

function memberSubcaption(rule) {
  const r = rule || 'list';
  if (r === 'promo') return 'after portal promo';
  if (r === 'percent_off') return '% off your seat';
  if (r === 'amount_off') return 'amount off your seat';
  if (r === 'fixed_price') return 'fixed member price';
  if (r === 'included_in_package') return '';
  return 'list / offer unit';
}

function familySubcaption(rule) {
  const r = rule || 'list';
  if (r === 'promo') return 'after portal promo';
  if (r === 'percent_off') return '% off family total';
  if (r === 'amount_off') return 'amount off family total';
  if (r === 'fixed_price') return 'fixed per seat × count';
  if (r === 'none') return '';
  return 'list / offer';
}

/** Same basis as EnrollmentPage promo discount: percentage of subtotal or fixed per currency. */
function promoDiscountAmount(promoResult, subtotalRaw, currency) {
  if (!promoResult || subtotalRaw <= 0) return 0;
  if (promoResult.discount_type === 'percentage') {
    return Math.round(subtotalRaw * (Number(promoResult.discount_percentage) || 0) / 100);
  }
  return promoResult[`discount_${currency}`] || promoResult.discount_aed || 0;
}

export default function DashboardUpcomingFamilySection({ homeData, onRefresh }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings: siteSettings } = useSiteSettings();
  const annualIncludedIds = siteSettings?.annual_package_included_program_ids;
  const {
    getPrice,
    getOfferPrice,
    symbol,
    currency,
    ready: currencyReady,
    displayCurrency,
    isPrimary,
    displayRate,
  } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [promoByProgramId, setPromoByProgramId] = useState({});
  const [promoPricesLoading, setPromoPricesLoading] = useState(false);
  const [selectedFamilyByProgram, setSelectedFamilyByProgram] = useState({});
  const [annualQuotes, setAnnualQuotes] = useState({});
  const [payingProgramId, setPayingProgramId] = useState(null);
  const [payChannel, setPayChannel] = useState('stripe');

  const upcoming = homeData?.upcoming_programs || [];
  const programPortalMap = homeData?.dashboard_program_offers || {};
  const paymentMethods = homeData?.payment_methods || ['stripe'];
  const offers = homeData?.dashboard_offers || {};
  const annualOffer = offers.annual || {};
  const familyOffer = offers.family || {};
  const isAnnual = homeData?.is_annual_subscriber;
  const initialMembers = useMemo(() => homeData?.immediate_family || [], [homeData?.immediate_family]);

  const [members, setMembers] = useState(() => initialMembers);
  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const addRow = () => {
    if (members.length >= 12) return;
    setMembers((m) => [
      ...m,
      { id: '', name: '', relationship: 'Spouse', email: '', phone: '', date_of_birth: '', city: '', age: '' },
    ]);
  };

  const removeRow = (idx) => {
    setMembers((m) => m.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    setMembers((m) => {
      const next = [...m];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const saveFamily = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/student/family`,
        {
          members: members.map((m) => ({
            id: m.id || undefined,
            name: m.name,
            relationship: m.relationship,
            email: m.email,
            phone: m.phone,
            date_of_birth: m.date_of_birth || '',
            city: m.city || '',
            age: m.age || '',
          })),
        },
        { withCredentials: true }
      );
      toast({ title: 'Family saved', description: 'Your immediate family list has been updated.' });
      onRefresh?.();
    } catch {
      toast({ title: 'Could not save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const promoForProgramClicks = useMemo(() => {
    const a = (annualOffer.promo_code || '').trim();
    const f = (familyOffer.promo_code || '').trim();
    if (isAnnual) return annualOffer.enabled && a ? a : '';
    return familyOffer.enabled && f ? f : '';
  }, [isAnnual, annualOffer, familyOffer]);

  const upcomingSliceKey = useMemo(
    () => (upcoming || []).slice(0, 6).map((p) => p.id).join(','),
    [upcoming]
  );

  const familySelectionKey = useMemo(() => {
    return (upcoming || [])
      .slice(0, 6)
      .map((p) => `${p.id}=${(selectedFamilyByProgram[p.id] || []).slice().sort().join(':')}`)
      .join('|');
  }, [upcoming, selectedFamilyByProgram]);

  React.useEffect(() => {
    const m = homeData?.payment_methods || ['stripe'];
    if (m.length === 1 && m[0] === 'manual') setPayChannel('manual');
    if (m.length === 1 && m[0] === 'stripe') setPayChannel('stripe');
  }, [homeData?.payment_methods]);

  useEffect(() => {
    if (!isAnnual || !currencyReady) {
      setAnnualQuotes({});
      return;
    }
    const programs = (upcoming || []).slice(0, 6);
    if (programs.length === 0) {
      setAnnualQuotes({});
      return;
    }
    let cancelled = false;
    Promise.all(
      programs.map((p) => {
        const ids = selectedFamilyByProgram[p.id] || [];
        const params =
          ids.length > 0
            ? { program_id: p.id, currency, family_ids: ids.join(',') }
            : { program_id: p.id, currency, family_count: 0 };
        return axios
          .get(`${API}/api/student/dashboard-quote`, {
            params,
            withCredentials: true,
          })
          .then((r) => ({ id: p.id, data: r.data }))
          .catch(() => ({ id: p.id, data: null }));
      })
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach(({ id, data }) => {
        next[id] = data;
      });
      setAnnualQuotes(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isAnnual, currencyReady, currency, upcomingSliceKey, familySelectionKey]);

  useEffect(() => {
    const code = promoForProgramClicks;
    const programs = (upcoming || []).slice(0, 6);
    if (!code || !currencyReady || programs.length === 0) {
      setPromoByProgramId({});
      setPromoPricesLoading(false);
      return;
    }
    let cancelled = false;
    setPromoPricesLoading(true);
    Promise.all(
      programs.map((p) =>
        axios
          .post(`${API}/api/promotions/validate`, {
            code,
            program_id: p.id,
            currency,
          })
          .then((r) => ({ id: p.id, data: r.data }))
          .catch(() => ({ id: p.id, data: null }))
      )
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach(({ id, data }) => {
        next[id] = data;
      });
      setPromoByProgramId(next);
      setPromoPricesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [promoForProgramClicks, currencyReady, currency, upcomingSliceKey]);

  const toggleFamilyMember = (programId, memberId) => {
    const mid = String(memberId || '');
    if (!mid) return;
    setSelectedFamilyByProgram((prev) => {
      const cur = new Set(prev[programId] || []);
      if (cur.has(mid)) cur.delete(mid);
      else cur.add(mid);
      return { ...prev, [programId]: [...cur] };
    });
  };

  const startDashboardPayment = async (programId) => {
    const ids = selectedFamilyByProgram[programId] || [];
    setPayingProgramId(programId);
    try {
      const r = await axios.post(
        `${API}/api/student/dashboard-pay`,
        {
          program_id: programId,
          family_member_ids: ids,
          currency,
          origin_url: typeof window !== 'undefined' ? window.location.origin : '',
        },
        { withCredentials: true }
      );
      const { enrollment_id, tier_index: tierIdx } = r.data;

      if (payChannel === 'manual' && paymentMethods.includes('manual')) {
        navigate(`/manual-payment/${enrollment_id}`);
        return;
      }

      const checkout = await axios.post(
        `${API}/api/enrollment/${enrollment_id}/checkout`,
        {
          enrollment_id,
          item_type: 'program',
          item_id: programId,
          currency,
          display_currency: displayCurrency,
          display_rate: isPrimary ? 1 : displayRate,
          origin_url: typeof window !== 'undefined' ? window.location.origin : '',
          promo_code: null,
          tier_index: tierIdx != null ? tierIdx : null,
          points_to_redeem: 0,
          browser_timezone:
            typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
          browser_languages:
            typeof navigator !== 'undefined' && navigator.languages
              ? [...navigator.languages]
              : [typeof navigator !== 'undefined' ? navigator.language : 'en'],
        },
        { withCredentials: true }
      );
      if (checkout.data.url === '__FREE_SUCCESS__') {
        navigate(`/payment/success?session_id=${checkout.data.session_id}`);
      } else if (checkout.data.url) {
        window.location.href = checkout.data.url;
      }
    } catch (e) {
      toast({
        title: 'Could not start payment',
        description: e.response?.data?.detail || 'Try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setPayingProgramId(null);
    }
  };

  const OfferCard = ({ kind, offer, accent }) => {
    if (!offer?.enabled) return null;
    const title = offer.title || (kind === 'annual' ? 'Annual member offer' : 'Family offer');
    const body = offer.body || '';
    const code = (offer.promo_code || '').trim();
    const cta = offer.cta_label || 'View programs';
    const path = offer.cta_path || '/#upcoming';

    const navigateOfferCta = () => {
      let dest = path.trim() || '/#upcoming';
      if (!dest.startsWith('/') && !dest.startsWith('#')) dest = `/${dest}`;
      if ((dest.startsWith('/program/') || dest.startsWith('/enroll/')) && code) {
        const [base, hash] = dest.split('#');
        const params = new URLSearchParams();
        params.set('promo', code);
        params.set('source', 'dashboard');
        const join = base.includes('?') ? '&' : '?';
        const u = `${base}${join}${params.toString()}`;
        navigate(hash ? `${u}#${hash}` : u);
        return;
      }
      navigate(dest.startsWith('/') ? dest : `/${dest}`);
    };

    return (
      <div
        className={cn(
          'rounded-2xl border p-4 md:p-5 bg-white/80 backdrop-blur-sm shadow-sm',
          accent === 'gold'
            ? 'border-[#D4AF37]/35 bg-gradient-to-br from-amber-50/90 to-white/90'
            : 'border-violet-200/50 bg-gradient-to-br from-violet-50/80 to-white/90'
        )}
        data-testid={`dashboard-offer-${kind}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              accent === 'gold' ? 'bg-[#D4AF37]/20' : 'bg-violet-100'
            )}
          >
            {accent === 'gold' ? <Sparkles size={18} className="text-[#b8860b]" /> : <Users size={18} className="text-violet-700" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
              {kind === 'annual' ? 'For you (annual)' : 'For your family'}
            </p>
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{title}</h3>
            {body && <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{body}</p>}
            {code && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-900 bg-amber-100/80 border border-amber-200/80 rounded-lg px-2.5 py-1">
                <Tag size={12} /> {code}
              </p>
            )}
            <button
              type="button"
              onClick={navigateOfferCta}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#5D3FD3] hover:text-violet-800"
            >
              {cta}
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 mb-4 md:mb-6" data-testid="dashboard-upcoming-family">
      <div className="rounded-[28px] border border-[rgba(160,100,220,0.14)] bg-white/70 backdrop-blur-xl px-5 py-5 md:px-7 md:py-6 shadow-[0_4px_48px_rgba(140,60,220,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
            <Calendar size={17} className="text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="font-[family-name:'Cinzel',serif] text-[11px] uppercase tracking-[0.2em] text-[rgba(100,40,160,0.55)]">
              Upcoming programs
            </h2>
            <p className="text-xs text-slate-500">
              Member pricing and promos here are for your portal only. Enroll in one step from your saved profile and family list.
            </p>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">No upcoming programs listed yet — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {upcoming.slice(0, 6).map((p) => {
              const tierIdx = pickTierIndexForDashboard(p, isAnnual);
              const hasTiers = p.is_flagship && (p.duration_tiers || []).length > 0;
              const list = hasTiers && tierIdx !== null ? getPrice(p, tierIdx) : getPrice(p);
              const off = hasTiers && tierIdx !== null ? getOfferPrice(p, tierIdx) : getOfferPrice(p);
              const href = buildDashboardEnrollHref(p, { tierIdx, promoCode: promoForProgramClicks });
              const baseForPromo = off > 0 ? off : list;
              const validated = promoForProgramClicks ? promoByProgramId[p.id] : null;
              const disc =
                validated && baseForPromo > 0 ? promoDiscountAmount(validated, baseForPromo, currency) : 0;
              const afterPromo = Math.max(0, baseForPromo - disc);
              const showSpecialPromo =
                Boolean(promoForProgramClicks && validated && disc > 0 && !promoPricesLoading);
              const aq = annualQuotes[p.id];
              const includedPkg =
                aq?.included_in_annual_package ??
                programIncludedInAnnualPackage(p, annualIncludedIds);
              const selIds = selectedFamilyByProgram[p.id] || [];
              const selCount = selIds.length;
              const canPay = Boolean(aq && aq.total > 0 && (!includedPkg || selCount >= 1));
              const cardMedia = (
                <>
                  <div className="h-24 bg-slate-100 overflow-hidden">
                    <img
                      src={resolveImageUrl(p.image)}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      onError={(e) => {
                        e.target.src =
                          'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&h=200&fit=crop';
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] text-[#D4AF37] uppercase tracking-wider mb-0.5">{p.category || 'Program'}</p>
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{p.title}</p>
                    {(() => {
                      const row = programPortalMap[p.id];
                      const hasMap =
                        row &&
                        ((row.annual && Object.keys(row.annual).length > 0) ||
                          (row.family && Object.keys(row.family).length > 0));
                      return hasMap || annualQuotes[p.id]?.program_portal_pricing_override ? (
                        <p className="text-[9px] text-indigo-800/90 mt-1 font-medium leading-snug">
                          Program-specific member &amp; family pricing
                        </p>
                      ) : null;
                    })()}
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar size={10} /> {programStartLabel(p)}
                    </p>
                    {!isAnnual && (list > 0 || off > 0) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                        {showSpecialPromo ? (
                          <p className="text-[11px] text-slate-800">
                            <span className="font-semibold text-[#b8860b]">{symbol}{afterPromo.toLocaleString()}</span>
                            <span className="text-slate-400 line-through ml-1.5 text-[10px]">{symbol}{baseForPromo.toLocaleString()}</span>
                            <span className="block text-[9px] text-violet-700/90 mt-0.5">
                              With {promoForProgramClicks} (on offer price)
                            </span>
                            {off > 0 && list > off && (
                              <span className="block text-[9px] text-slate-400 mt-0.5">List {symbol}{list.toLocaleString()}</span>
                            )}
                          </p>
                        ) : off > 0 ? (
                          <p className="text-[11px] text-slate-800">
                            <span className="font-semibold text-[#b8860b]">{symbol}{off.toLocaleString()}</span>
                            {list > 0 && off < list && (
                              <span className="text-slate-400 line-through ml-1.5 text-[10px]">{symbol}{list.toLocaleString()}</span>
                            )}
                            <span className="block text-[9px] text-slate-400 mt-0.5">Offer price</span>
                          </p>
                        ) : list > 0 ? (
                          <p className="text-[11px] text-slate-800 font-medium">{symbol}{list.toLocaleString()}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              );
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200/90 bg-white/90 overflow-hidden hover:border-[#D4AF37]/40 hover:shadow-md transition-all flex flex-col"
                  data-testid={`dashboard-upcoming-${p.id}`}
                >
                  {isAnnual ? (
                    <div className="text-left w-full group">{cardMedia}</div>
                  ) : (
                    <div
                      className="text-left w-full group cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Enroll in ${p.title || 'program'}`}
                      onClick={() => navigate(href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(href);
                        }
                      }}
                    >
                      {cardMedia}
                    </div>
                  )}
                  <div className="px-3 pb-2 pt-0">
                    <button
                      type="button"
                      className="text-[10px] text-violet-700 hover:text-violet-900 font-medium underline-offset-2 hover:underline text-left w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/program/${p.id}`);
                      }}
                      data-testid={`dashboard-know-more-${p.id}`}
                    >
                      Know more about this program
                    </button>
                  </div>

                  {isAnnual && (
                    <div className="px-3 pb-3 pt-0 border-t border-slate-100 bg-gradient-to-b from-amber-50/40 to-transparent">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#b8860b] mt-2 mb-1">
                        Annual member checkout
                      </p>
                      {includedPkg && (
                        <p className="text-[10px] text-slate-600 leading-snug mb-2">
                          This program is included in your annual package for you. Select family members below to pay for
                          their enrollment only.
                        </p>
                      )}
                      {aq ? (
                        <div className="space-y-1 text-[11px] text-slate-700">
                          {!includedPkg && (
                            <div className="flex justify-between gap-2">
                              <span className="leading-snug">
                                You
                                {memberSubcaption(aq.member_pricing_rule) ? (
                                  <>
                                    {' '}
                                    <span className="text-slate-500">— {memberSubcaption(aq.member_pricing_rule)}</span>
                                  </>
                                ) : null}
                              </span>
                              <span className="font-medium tabular-nums">
                                {symbol}
                                {Number(aq.self_after_promos || 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {(includedPkg ? selCount > 0 : selCount > 0) && (
                            <div className="flex justify-between gap-2 text-slate-600">
                              <span className="leading-snug">
                                Family ({selCount})
                                {familySubcaption(aq.family_pricing_rule) ? (
                                  <>
                                    {' '}
                                    <span className="text-slate-500">— {familySubcaption(aq.family_pricing_rule)}</span>
                                  </>
                                ) : null}
                              </span>
                              <span className="font-medium tabular-nums">
                                {symbol}
                                {Number(aq.family_after_promos || 0).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-2 pt-1 border-t border-amber-100/80 font-semibold text-slate-900">
                            <span>Total</span>
                            <span className="text-[#b8860b] tabular-nums">
                              {symbol}
                              {Number(aq.total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 py-1">Loading pricing…</p>
                      )}

                      <div className="mt-2 space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          Family to enroll
                        </p>
                        {members.length === 0 ? (
                          <p className="text-[10px] text-slate-400">Add family members in the section below first.</p>
                        ) : (
                          <ul className="space-y-1 max-h-28 overflow-y-auto">
                            {members.map((m) => {
                              const mid = m.id || `${m.name}-${m.email}`;
                              return (
                                <li key={mid}>
                                  <label className="flex items-center gap-2 text-[11px] text-slate-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="rounded border-slate-300"
                                      disabled={!m.id}
                                      checked={!!m.id && selIds.includes(String(m.id))}
                                      onChange={() => m.id && toggleFamilyMember(p.id, String(m.id))}
                                    />
                                    <span>
                                      {m.name || '—'}
                                      {m.relationship ? (
                                        <span className="text-slate-400"> ({m.relationship})</span>
                                      ) : null}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {includedPkg && selCount === 0 && (
                          <p className="text-[9px] text-amber-800 bg-amber-50/80 rounded px-2 py-1">
                            Select who you are paying for — your own seat is already covered.
                          </p>
                        )}
                      </div>

                      {paymentMethods.filter((x) => x === 'stripe' || x === 'manual').length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-700">
                          {paymentMethods.includes('stripe') && (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`pay-${p.id}`}
                                checked={payChannel === 'stripe'}
                                onChange={() => setPayChannel('stripe')}
                              />
                              Card (Stripe)
                            </label>
                          )}
                          {paymentMethods.includes('manual') && (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`pay-${p.id}`}
                                checked={payChannel === 'manual'}
                                onChange={() => setPayChannel('manual')}
                              />
                              Bank / manual
                            </label>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canPay || payingProgramId === p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          startDashboardPayment(p.id);
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D4AF37] text-white text-[11px] font-semibold py-2 px-3 hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none"
                        data-testid={`dashboard-pay-${p.id}`}
                      >
                        {payingProgramId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        {payChannel === 'manual' && paymentMethods.includes('manual')
                          ? 'Continue to manual payment'
                          : 'Pay now'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {((isAnnual && annualOffer?.enabled) || familyOffer?.enabled) ? (
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {isAnnual && annualOffer?.enabled ? (
              <OfferCard kind="annual" offer={annualOffer} accent="gold" />
            ) : null}
            {familyOffer?.enabled ? (
              <OfferCard kind="family" offer={familyOffer} accent="violet" />
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-slate-200/80 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-violet-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Immediate family</h3>
              <p className="text-[11px] text-slate-500">
                Add household members (name, relationship, date of birth, age, city) for family-only offers. These stay on your dashboard for faster enrollments (max 12).
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {members.length === 0 && (
              <p className="text-xs text-slate-400 italic">No family members added yet.</p>
            )}
            {members.map((m, idx) => (
              <div
                key={m.id || `row-${idx}`}
                className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-3">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Name</label>
                    <input
                      value={m.name}
                      onChange={(e) => updateRow(idx, 'name', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                      placeholder="Full name"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Relationship</label>
                    <select
                      value={m.relationship || 'Other'}
                      onChange={(e) => updateRow(idx, 'relationship', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                    >
                      {RELATIONSHIPS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Date of birth</label>
                    <input
                      type="date"
                      value={(m.date_of_birth || '').slice(0, 10)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMembers((prev) => {
                          const next = [...prev];
                          const cur = { ...next[idx], date_of_birth: v };
                          if (v) {
                            const d = new Date(`${v}T12:00:00`);
                            if (!Number.isNaN(d.getTime())) {
                              const today = new Date();
                              let age = today.getFullYear() - d.getFullYear();
                              const mdiff = today.getMonth() - d.getMonth();
                              if (mdiff < 0 || (mdiff === 0 && today.getDate() < d.getDate())) age -= 1;
                              cur.age = String(Math.max(0, age));
                            }
                          }
                          next[idx] = cur;
                          return next;
                        });
                      }}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={m.age || ''}
                      onChange={(e) => updateRow(idx, 'age', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                      placeholder="—"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">City</label>
                    <input
                      value={m.city || ''}
                      onChange={(e) => updateRow(idx, 'city', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                      placeholder="City"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 self-end"
                      aria-label="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Email (optional)</label>
                    <input
                      value={m.email || ''}
                      onChange={(e) => updateRow(idx, 'email', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Phone (optional)</label>
                    <input
                      value={m.phone || ''}
                      onChange={(e) => updateRow(idx, 'phone', e.target.value)}
                      className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                      placeholder="+…"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              disabled={members.length >= 12}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5D3FD3] border border-violet-200 rounded-full px-3 py-1.5 hover:bg-violet-50 disabled:opacity-40"
            >
              <Plus size={14} /> Add family member
            </button>
            <button
              type="button"
              onClick={saveFamily}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 py-1.5 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save family list
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
