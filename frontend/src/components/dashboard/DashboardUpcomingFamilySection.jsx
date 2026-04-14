import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Sparkles, Users, Tag, ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useCurrency } from '../../context/CurrencyContext';
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

function buildDashboardProgramHref(p, { tierIdx, promoCode }) {
  const q = new URLSearchParams();
  if (tierIdx !== null && tierIdx !== undefined) q.set('tier', String(tierIdx));
  if (promoCode && String(promoCode).trim()) q.set('promo', String(promoCode).trim());
  const qs = q.toString();
  return qs ? `/program/${p.id}?${qs}` : `/program/${p.id}`;
}

function programStartLabel(p) {
  const d = p.start_date || p.deadline_date;
  if (!d) return 'Dates TBC';
  const iso = String(d).slice(0, 10);
  return formatDateDdMonYyyy(iso) || d;
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
  const { getPrice, getOfferPrice, symbol, currency, ready: currencyReady } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [promoByProgramId, setPromoByProgramId] = useState({});
  const [promoPricesLoading, setPromoPricesLoading] = useState(false);

  const upcoming = homeData?.upcoming_programs || [];
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
    setMembers((m) => [...m, { id: '', name: '', relationship: 'Spouse', email: '', phone: '' }]);
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
        const u = base.includes('?') ? `${base}&${new URLSearchParams({ promo: code }).toString()}` : `${base}?promo=${encodeURIComponent(code)}`;
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
            <p className="text-xs text-slate-500">Open enrollments and what&apos;s next on the public site</p>
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
              const href = buildDashboardProgramHref(p, { tierIdx, promoCode: promoForProgramClicks });
              const baseForPromo = off > 0 ? off : list;
              const validated = promoForProgramClicks ? promoByProgramId[p.id] : null;
              const disc =
                validated && baseForPromo > 0 ? promoDiscountAmount(validated, baseForPromo, currency) : 0;
              const afterPromo = Math.max(0, baseForPromo - disc);
              const showSpecialPromo =
                Boolean(promoForProgramClicks && validated && disc > 0 && !promoPricesLoading);
              return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(href)}
                className="text-left rounded-2xl border border-slate-200/90 bg-white/90 overflow-hidden hover:border-[#D4AF37]/40 hover:shadow-md transition-all group"
                data-testid={`dashboard-upcoming-${p.id}`}
              >
                <div className="h-24 bg-slate-100 overflow-hidden">
                  <img
                    src={resolveImageUrl(p.image)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&h=200&fit=crop';
                    }}
                  />
                </div>
                <div className="p-3">
                  <p className="text-[9px] text-[#D4AF37] uppercase tracking-wider mb-0.5">{p.category || 'Program'}</p>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{p.title}</p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar size={10} /> {programStartLabel(p)}
                  </p>
                  {(list > 0 || off > 0) && (
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
              </button>
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
                Add household members so we can align family offers and enrollments (max 12).
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
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-xl border border-slate-200/90 bg-slate-50/50 p-2.5"
              >
                <div className="sm:col-span-3">
                  <label className="text-[9px] text-slate-500 uppercase tracking-wide">Name</label>
                  <input
                    value={m.name}
                    onChange={(e) => updateRow(idx, 'name', e.target.value)}
                    className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                    placeholder="Full name"
                  />
                </div>
                <div className="sm:col-span-3">
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
                <div className="sm:col-span-3">
                  <label className="text-[9px] text-slate-500 uppercase tracking-wide">Email (optional)</label>
                  <input
                    value={m.email || ''}
                    onChange={(e) => updateRow(idx, 'email', e.target.value)}
                    className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-slate-500 uppercase tracking-wide">Phone (optional)</label>
                  <input
                    value={m.phone || ''}
                    onChange={(e) => updateRow(idx, 'phone', e.target.value)}
                    className="w-full mt-0.5 text-xs border rounded-md px-2 py-1.5 bg-white"
                    placeholder="+…"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
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
