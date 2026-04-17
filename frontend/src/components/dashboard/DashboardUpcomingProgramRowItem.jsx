import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Bell, BellOff, ShoppingCart, Check, CreditCard, Loader2, Monitor, Wifi } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../hooks/use-toast';
import { resolveImageUrl } from '../../lib/imageUtils';
import { buildHomepageStyleDatetimeBadges } from '../../lib/upcomingHomepagePresentation';
import { CountdownTimer, compactTierButtonLabel } from '../UpcomingProgramsSection';
import {
  pickTierIndexForDashboard,
  programIncludedInAnnualPackage,
  promoDiscountAmount,
} from './dashboardUpcomingHelpers';

/** Bottom-left panel: portal quote lines (template: “Prices / calculate total”). */
function AnnualQuoteBreakdown({ aq, symbol, includedPkg }) {
  if (!aq) {
    return <p className="text-[11px] text-slate-500 italic">Calculating total…</p>;
  }
  const imm = Number(aq.immediate_family_count || 0);
  const ext = Number(aq.extended_guest_count || 0);
  const showSelf = !includedPkg && aq.include_self !== false;
  return (
    <div className="space-y-2 text-[11px] text-slate-700 leading-snug">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Prices — Annual member · Immediate family · Friends &amp; extended
      </p>
      <p className="font-semibold text-slate-900 text-xs">Calculate total amount</p>
      <ul className="list-none space-y-1.5 pl-0 text-[11px]">
        {includedPkg ? <li className="text-slate-600">Your seat: included in annual package</li> : null}
        {showSelf ? (
          <li>
            You (annual member):{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {symbol}
              {Number(aq.self_after_promos ?? 0).toLocaleString()}
            </span>
            {Number(aq.self_unit) > Number(aq.self_after_promos ?? 0) ? (
              <span className="text-slate-400 line-through ml-1.5 tabular-nums">
                {symbol}
                {Number(aq.self_unit).toLocaleString()}
              </span>
            ) : null}
          </li>
        ) : null}
        {imm > 0 ? (
          <li>
            Immediate family × {imm}:{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {symbol}
              {Number(aq.immediate_family_after_promos ?? 0).toLocaleString()}
            </span>
            {imm > 1 ? (
              <span className="text-slate-500 ml-1">
                ({symbol}
                {(Number(aq.immediate_family_after_promos) / imm).toFixed(0)} each)
              </span>
            ) : null}
          </li>
        ) : null}
        {ext > 0 ? (
          <li>
            Friends &amp; extended × {ext}:{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {symbol}
              {Number(aq.extended_guests_after_promos ?? 0).toLocaleString()}
            </span>
            {ext > 1 ? (
              <span className="text-slate-500 ml-1">
                ({symbol}
                {(Number(aq.extended_guests_after_promos) / ext).toFixed(0)} each)
              </span>
            ) : null}
          </li>
        ) : null}
        <li className="pt-2 mt-1 border-t border-slate-200 font-bold text-slate-900 tabular-nums">
          Total: {symbol}
          {Number(aq.total ?? 0).toLocaleString()}
        </li>
      </ul>
    </div>
  );
}

/**
 * Upcoming program row: non-annual = homepage-style horizontal card (hero + body).
 * Annual = fixed 2×2 template: program card (stacked hero + copy + quote total + Know More) |
 * two-column family picks | portal price breakdown | enrollment + pay.
 */
export default function DashboardUpcomingProgramRowItem({
  program: p,
  isAnnual: subscriberIsAnnual,
  detectedCountry,
  symbol,
  currency,
  getPrice,
  getOfferPrice,
  promoForProgramClicks,
  promoByProgramId,
  promoPricesLoading,
  aq,
  annualIncludedIds,
  members,
  otherMembers,
  enrollableGuests,
  selectableFamilyMemberIds,
  selectedFamilyByProgram,
  toggleFamilyMember,
  toggleSelectAllFamilyForProgram,
  addProgramToCartAndGo,
  openEnrollmentSeatModal,
  payingProgramId,
  annualSeatUi = null,
}) {
  const navigate = useNavigate();
  const { addItem, items } = useCart();
  const { toast } = useToast();

  const tiers = p.duration_tiers || [];
  const hasTiers = p.is_flagship && tiers.length > 0;

  const [localTier, setLocalTier] = useState(() => pickTierIndexForDashboard(p, false) ?? 0);

  useEffect(() => {
    setLocalTier(pickTierIndexForDashboard(p, false) ?? 0);
  }, [p.id, p.is_flagship, tiers.length]);

  const tierIdxForDisplay = subscriberIsAnnual ? pickTierIndexForDashboard(p, true) ?? 0 : localTier;
  const tier = hasTiers ? tiers[tierIdxForDisplay] : null;
  const tierIsYearLong =
    tier &&
    (tier.label.toLowerCase().includes('annual') ||
      tier.label.toLowerCase().includes('year') ||
      tier.duration_unit === 'year');

  const price = getPrice(p, hasTiers ? tierIdxForDisplay : null);
  const offerPrice = getOfferPrice(p, hasTiers ? tierIdxForDisplay : null);
  const showContact = !subscriberIsAnnual && tierIsYearLong && price === 0;

  const deadline = p.deadline_date || p.start_date;
  const expired = useMemo(() => {
    if (!deadline) return false;
    const t = new Date(deadline);
    return !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
  }, [deadline]);

  const enrollStatus = expired ? 'closed' : p.enrollment_status || (p.enrollment_open !== false ? 'open' : 'closed');

  const datetimeBadges = buildHomepageStyleDatetimeBadges(p, tierIdxForDisplay, detectedCountry);

  const validated = promoForProgramClicks ? promoByProgramId[p.id] : null;
  const baseForPromo = offerPrice > 0 ? offerPrice : price;
  const disc = validated && baseForPromo > 0 ? promoDiscountAmount(validated, baseForPromo, currency) : 0;
  const afterPromo = Math.max(0, baseForPromo - disc);
  const showSpecialPromo = Boolean(promoForProgramClicks && validated && disc > 0 && !promoPricesLoading);

  const includedPkg = aq?.included_in_annual_package ?? programIncludedInAnnualPackage(p, annualIncludedIds);
  const selIds = selectedFamilyByProgram[p.id] || [];
  const selCount = selIds.length;
  const canPay = Boolean(aq && aq.total > 0 && (!includedPkg || selCount >= 1));

  const inCart = items.some((i) => i.programId === p.id && i.tierIndex === tierIdxForDisplay);
  const [justAdded, setJustAdded] = useState(false);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    const added = addItem(p, tierIdxForDisplay);
    if (added) {
      setJustAdded(true);
      toast({
        title: `${p.title} added to cart`,
        description: `${tier?.label || 'Selected'} plan`,
      });
      setTimeout(() => setJustAdded(false), 2000);
    } else {
      toast({ title: 'Already in cart', variant: 'destructive' });
    }
  };

  const goProgram = () => navigate(`/program/${p.id}`);

  const heroClick = () => {
    if (!subscriberIsAnnual && enrollStatus === 'open') {
      addProgramToCartAndGo(p, localTier);
    } else if (enrollStatus === 'open') {
      goProgram();
    }
  };

  const tierGridClass =
    tiers.length <= 1 ? 'grid-cols-1' : tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  const outerShellClass = subscriberIsAnnual
    ? `w-full max-w-6xl mr-auto transition-all duration-300 ${enrollStatus === 'closed' ? 'opacity-60' : ''}`
    : `group bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 flex flex-col sm:flex-row sm:items-stretch w-full max-w-md mr-auto transition-all duration-300 ${
        enrollStatus === 'closed' ? 'opacity-60' : 'hover:shadow-2xl'
      }`;

  const heroShellClass = subscriberIsAnnual
    ? 'relative h-48 w-full shrink-0 overflow-hidden'
    : 'relative h-48 w-full sm:w-48 shrink-0 overflow-hidden';

  const heroBlock = (
    <div
      className={`${heroShellClass} ${
        enrollStatus === 'open' && !subscriberIsAnnual ? 'cursor-pointer' : enrollStatus === 'open' ? 'cursor-pointer' : ''
      }`}
        onClick={heroClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            heroClick();
          }
        }}
        role={enrollStatus === 'open' ? 'button' : undefined}
        tabIndex={enrollStatus === 'open' ? 0 : undefined}
        aria-label={
          subscriberIsAnnual || enrollStatus !== 'open'
            ? `Open ${p.title || 'program'}`
            : `Add ${p.title || 'program'} to cart`
        }
      >
        <img
          src={resolveImageUrl(p.image)}
          alt={p.title || ''}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            enrollStatus === 'open' ? 'group-hover:scale-105' : enrollStatus === 'closed' ? 'grayscale-[40%]' : ''
          }`}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop';
          }}
        />

        {enrollStatus === 'open' ? (
          <>
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 max-w-[48%]">
              {p.enable_online !== false && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-blue-500 text-white w-fit leading-snug">
                  Online (Zoom)
                </span>
              )}
              {p.enable_offline !== false && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-600 text-white w-fit leading-snug">
                  Offline (Remote, Not In-Person)
                </span>
              )}
              {p.enable_in_person && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm bg-teal-700 text-white w-fit leading-snug">
                  In-Person
                </span>
              )}
            </div>

            {datetimeBadges.length > 0 && (
              <div
                className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1 max-w-[52%]"
                data-testid={`dashboard-hero-datetime-${p.id}`}
              >
                {datetimeBadges.map((row, idx) =>
                  row.type === 'duration' ? (
                    <span
                      key={idx}
                      className="bg-[#D4AF37] backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wide"
                    >
                      {row.text}
                    </span>
                  ) : (
                    <span
                      key={idx}
                      className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"
                    >
                      {row.type === 'clock' ? (
                        <Clock size={10} className="flex-shrink-0" />
                      ) : (
                        <Calendar size={10} className="flex-shrink-0" />
                      )}
                      <span className="text-left leading-snug">{row.text}</span>
                    </span>
                  )
                )}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6">
              <div className="flex items-end justify-between gap-2">
                <div className="flex-shrink-0 min-w-0">
                  {deadline && <CountdownTimer deadline={deadline} />}
                </div>
                {p.exclusive_offer_enabled && p.exclusive_offer_text && (
                  <span
                    data-testid={`dashboard-exclusive-offer-${p.id}`}
                    className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg tracking-wide uppercase animate-pulse text-right leading-snug max-w-[55%]"
                  >
                    {p.exclusive_offer_text}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : enrollStatus === 'coming_soon' ? (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center z-20">
            <span className="bg-blue-600/95 text-white text-sm font-bold px-6 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/20">
              Coming Soon
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-20">
            <span className="bg-gray-900/92 text-white text-sm font-bold px-5 py-2.5 rounded-full tracking-wider uppercase shadow-xl border border-white/15 text-center max-w-[90%]">
              {p.closure_text || 'Registration Closed'}
            </span>
          </div>
        )}
      </div>
  );

  return (
    <div className={outerShellClass} data-testid={`dashboard-upcoming-${p.id}`}>
      {subscriberIsAnnual ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-stretch w-full">
          <div
            className={`group bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 flex flex-col min-h-0 ${
              enrollStatus === 'closed' ? 'opacity-60' : 'hover:shadow-2xl'
            }`}
          >
            {heroBlock}
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">{p.category || 'Program'}</p>
              <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                <h3 className="text-base font-semibold text-gray-900 leading-tight pr-1">{p.title}</h3>
                {hasTiers && tierIsYearLong && (
                  <span className="flex-shrink-0 inline-flex items-center rounded-md border border-[#D4AF37]/40 bg-amber-50/95 text-[8px] font-bold uppercase tracking-wider text-[#6b5210] px-2 py-0.5">
                    Annual
                  </span>
                )}
                {p.highlight_label && (
                  <span
                    data-testid={`dashboard-highlight-annual-${p.id}`}
                    className={`flex-shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase px-2 py-1 rounded-full whitespace-nowrap ${
                      p.highlight_style === 'glow' ? 'animate-pulse' : ''
                    }`}
                    style={
                      p.highlight_style === 'ribbon'
                        ? {
                            background: '#1a1a1a',
                            color: '#D4AF37',
                            letterSpacing: '0.08em',
                            borderLeft: '2px solid #D4AF37',
                            borderRadius: '4px',
                          }
                        : p.highlight_style === 'glow'
                          ? {
                              background: 'linear-gradient(135deg, #fff8e7, #fff3d0)',
                              color: '#b8860b',
                              border: '1px solid #D4AF3755',
                              letterSpacing: '0.06em',
                              boxShadow: '0 0 10px rgba(212,175,55,0.2)',
                            }
                          : {
                              background: 'linear-gradient(135deg, #D4AF37, #f5d77a, #D4AF37)',
                              color: '#3d2200',
                              letterSpacing: '0.06em',
                              boxShadow: '0 2px 6px rgba(212,175,55,0.25)',
                            }
                    }
                  >
                    {p.highlight_style !== 'ribbon' && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill={p.highlight_style === 'glow' ? 'none' : '#3d2200'} stroke={p.highlight_style === 'glow' ? '#b8860b' : 'none'} strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                    {p.highlight_label}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs leading-relaxed mb-2 line-clamp-3">{p.description}</p>
              {enrollStatus === 'open' &&
                offerPrice > 0 &&
                deadline &&
                (() => {
                  const dl = new Date(deadline);
                  if (dl <= new Date()) return null;
                  const diff = dl - Date.now();
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  return (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 animate-pulse">
                      <Bell size={14} className="text-red-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-red-600">{p.offer_text || 'Early Bird'}</span>
                        <span className="text-red-500 ml-1.5">
                          ends in {days}d {hours}h {mins}m
                        </span>
                      </div>
                    </div>
                  );
                })()}
              {aq ? (
                <div className="flex flex-wrap items-baseline gap-2 mb-3">
                  <span className="text-xl font-bold text-[#D4AF37] tabular-nums">
                    {symbol} {Number(aq.total ?? 0).toLocaleString()}
                  </span>
                  {!includedPkg && Number(aq.self_unit) > Number(aq.self_after_promos ?? 0) ? (
                    <span className="text-xs text-gray-400 line-through tabular-nums">
                      {symbol} {Number(aq.self_unit).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mb-2">Loading price…</p>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goProgram();
                }}
                data-testid={`dashboard-know-more-annual-${p.id}`}
                className="w-full inline-flex items-center justify-center bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 px-6 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
              >
                Know More
              </button>
              {enrollStatus === 'closed' && (
                <button
                  type="button"
                  disabled
                  className="mt-3 w-full bg-gray-300 text-gray-500 py-2 rounded-full text-[10px] tracking-wider uppercase font-medium cursor-not-allowed"
                >
                  {p.closure_text || 'Closed'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-100/80 bg-amber-50/25 p-3 sm:p-4 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-2">Family members to join</p>
                {enrollableGuests.length === 0 ? (
                  <p className="text-xs text-slate-500">Add people under the lists below, then save.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectableFamilyMemberIds.length > 0 ? (
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none pb-1 border-b border-slate-200/80">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={
                            selectableFamilyMemberIds.length > 0 &&
                            selectableFamilyMemberIds.every((id) => selIds.includes(id))
                          }
                          ref={(el) => {
                            if (!el) return;
                            const some = selectableFamilyMemberIds.some((id) => selIds.includes(id));
                            const all =
                              selectableFamilyMemberIds.length > 0 &&
                              selectableFamilyMemberIds.every((id) => selIds.includes(id));
                            el.indeterminate = some && !all;
                          }}
                          onChange={() => toggleSelectAllFamilyForProgram(p.id)}
                        />
                        <span>Add all ({selectableFamilyMemberIds.length} saved)</span>
                      </label>
                    ) : null}
                    {members.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Immediate family</p>
                        <ul className="space-y-1.5">
                          {members.map((m, gidx) => {
                            const mid = m.id || `imm-${gidx}-${m.name}-${m.email}`;
                            return (
                              <li key={mid}>
                                <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300"
                                    disabled={!m.id}
                                    checked={!!m.id && selIds.includes(String(m.id))}
                                    onChange={() => m.id && toggleFamilyMember(p.id, String(m.id))}
                                  />
                                  <span>
                                    {m.name || '—'}
                                    {m.relationship ? <span className="text-slate-500"> ({m.relationship})</span> : null}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No immediate family rows yet.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Friends &amp; extended</p>
                {otherMembers.length > 0 ? (
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {otherMembers.map((m, gidx) => {
                      const mid = m.id || `ext-${gidx}-${m.name}-${m.email}`;
                      return (
                        <li key={mid}>
                          <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              disabled={!m.id}
                              checked={!!m.id && selIds.includes(String(m.id))}
                              onChange={() => m.id && toggleFamilyMember(p.id, String(m.id))}
                            />
                            <span>
                              {m.name || '—'}
                              {m.relationship ? <span className="text-slate-500"> ({m.relationship})</span> : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No saved guests in this list yet.</p>
                )}
              </div>
            </div>
            {includedPkg && selCount === 0 && (
              <p className="text-xs text-amber-900 bg-amber-50/90 rounded-lg px-2 py-2 mt-2 border border-amber-200/80">
                Select who you are paying for — your seat is already covered.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-h-0">
            <AnnualQuoteBreakdown aq={aq} symbol={symbol} includedPkg={includedPkg} />
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm flex flex-col gap-3 min-h-0">
            {annualSeatUi && (!includedPkg || selCount >= 1) ? (
              <div
                className="rounded-lg border border-violet-200/80 bg-gradient-to-b from-violet-50/40 to-white px-2.5 py-2 space-y-2"
                data-testid={`dashboard-compact-seat-${p.id}`}
              >
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 leading-tight">Enrollment for this program</p>
                  <p className="text-[9px] text-slate-600 leading-snug mt-0.5">
                    Set attendance and enrollment notification email for this checkout — including the WhatsApp group link
                    when applicable. Combine the options below, or save your choices as the default for every program on
                    this device.
                  </p>
                </div>
                {annualSeatUi.draft?.enrollmentDefaultsLoaded ? (
                  <p className="text-[9px] text-violet-900 bg-violet-100/80 border border-violet-200/60 rounded px-2 py-1 leading-snug">
                    Loaded your <strong>saved defaults</strong> for this browser. Adjust below or{' '}
                    <button
                      type="button"
                      className="font-semibold text-violet-800 underline underline-offset-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        annualSeatUi.onClearSavedDefaults();
                      }}
                    >
                      clear
                    </button>
                    .
                  </p>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-md border border-violet-100/90 bg-violet-50/35 px-2 py-1.5 space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Attendance (pick one)</p>
                    <div className="space-y-0.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.attendanceQuickPreset === 'all_online'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onApplyAttendanceDraft(p.id, 'all_online');
                          }}
                        />
                        All online
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.attendanceQuickPreset === 'all_offline'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onApplyAttendanceDraft(p.id, 'all_offline');
                          }}
                        />
                        All offline
                      </label>
                      {!includedPkg ? (
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 shrink-0 scale-90"
                            checked={annualSeatUi.attendanceQuickPreset === 'except_me'}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) annualSeatUi.onApplyAttendanceDraft(p.id, 'guests_offline_booker_online');
                            }}
                          />
                          All offline except Myself
                        </label>
                      ) : null}
                    </div>
                    {annualSeatUi.attendanceQuickPreset === 'custom' ? (
                      <p className="text-[8px] text-amber-800/90">Mixed — use advanced or pick a preset.</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-slate-200/90 bg-slate-50/50 px-2 py-1.5 space-y-1">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500 leading-snug">
                      Enrollment Notification Email (for WhatsApp Group Link)
                    </p>
                    <div className="space-y-0.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.notifyQuickPreset === 'email_all'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onApplyNotifyDraft(p.id, 'all_on');
                          }}
                        />
                        Email all
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.notifyQuickPreset === 'email_me_only'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onApplyNotifyDraft(p.id, 'me_only');
                          }}
                        />
                        Email Me Only
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.notifyQuickPreset === 'custom'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onApplyNotifyDraft(p.id, 'all_off');
                          }}
                        />
                        Custom
                      </label>
                    </div>
                    {annualSeatUi.notifyQuickPreset === 'mixed' ? (
                      <p className="text-[8px] text-amber-800/90">Mixed — open advanced.</p>
                    ) : null}
                  </div>
                </div>

                {!includedPkg ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-700 border-t border-slate-200/60 pt-1.5">
                    <span className="font-medium text-slate-600 shrink-0">You</span>
                    <span className="truncate max-w-[10rem]">{annualSeatUi.bookerDisplayName}</span>
                    <label className="inline-flex items-center gap-0.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`dash-inline-booker-${p.id}`}
                        checked={(annualSeatUi.draft?.bookerSeatMode || 'online') !== 'offline'}
                        onChange={() => annualSeatUi.onPatchDraft(p.id, { bookerSeatMode: 'online' })}
                      />
                      <Wifi size={11} className="text-slate-500" />
                      Online
                    </label>
                    <label className="inline-flex items-center gap-0.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`dash-inline-booker-${p.id}`}
                        checked={(annualSeatUi.draft?.bookerSeatMode || 'online') === 'offline'}
                        onChange={() => annualSeatUi.onPatchDraft(p.id, { bookerSeatMode: 'offline' })}
                      />
                      <Monitor size={11} className="text-slate-500" />
                      Offline
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer ml-1">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 scale-90"
                        checked={annualSeatUi.draft?.bookerSeatNotify !== false}
                        onChange={(e) => annualSeatUi.onPatchDraft(p.id, { bookerSeatNotify: e.target.checked })}
                      />
                      <span className="inline-flex items-center gap-0.5">
                        {annualSeatUi.draft?.bookerSeatNotify !== false ? (
                          <Bell size={11} className="text-slate-500" />
                        ) : (
                          <BellOff size={11} className="text-slate-400" />
                        )}
                        Email me details
                      </span>
                    </label>
                  </div>
                ) : null}

                <label className="flex items-start gap-1.5 cursor-pointer text-[10px] text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 scale-90"
                    checked={!!annualSeatUi.draft?.persistEnrollmentDefaultsOnContinue}
                    onChange={(e) =>
                      annualSeatUi.onPatchDraft(p.id, { persistEnrollmentDefaultsOnContinue: e.target.checked })
                    }
                  />
                  <span className="leading-snug">
                    <span className="font-medium">Save these choices as my default for every program</span>
                  </span>
                </label>

                <button
                  type="button"
                  className="text-[9px] text-violet-700 hover:text-violet-900 underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    annualSeatUi.onOpenAdvancedModal();
                  }}
                >
                  Per-person attendance &amp; email…
                </button>
              </div>
            ) : null}

            <p className="text-xs text-slate-500 leading-relaxed">
              Payment method in the next step matches your membership (Stripe vs UPI / bank).
            </p>
            <button
              type="button"
              disabled={!canPay || payingProgramId === p.id}
              title={
                !canPay
                  ? includedPkg && selCount < 1
                    ? 'Select family members to join or wait for pricing.'
                    : !aq
                      ? 'Loading pricing…'
                      : (aq.total || 0) <= 0
                        ? 'No amount due for this selection.'
                        : ''
                  : undefined
              }
              onClick={(e) => {
                e.stopPropagation();
                if (annualSeatUi?.onContinuePay) {
                  annualSeatUi.onContinuePay();
                } else {
                  openEnrollmentSeatModal(p, includedPkg, selIds);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-white text-sm font-semibold py-2.5 px-4 hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none shadow-sm mt-auto"
              data-testid={`dashboard-pay-${p.id}`}
            >
              {payingProgramId === p.id ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
              Continue to enrollment &amp; payment
            </button>
          </div>
        </div>
      ) : (
        <>
          {heroBlock}
      {/* Body — homepage UpcomingCard padding; content to the right of hero on sm+ */}
      <div className="flex-1 min-w-0 flex flex-col p-4">
        <p className="text-[#D4AF37] text-[10px] tracking-wider mb-0.5 uppercase">
          {p.category || 'Program'}
        </p>
        <div className="flex items-start gap-2 mb-1.5 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900 leading-tight pr-1">
            {p.title}
          </h3>
          {hasTiers && tierIsYearLong && (
            <span className="flex-shrink-0 inline-flex items-center rounded-md border border-[#D4AF37]/40 bg-amber-50/95 text-[8px] font-bold uppercase tracking-wider text-[#6b5210] px-2 py-0.5">
              Annual
            </span>
          )}
          {p.highlight_label && (
            <span
              data-testid={`dashboard-highlight-${p.id}`}
              className={`flex-shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase px-2 py-1 rounded-full whitespace-nowrap ${
                p.highlight_style === 'glow' ? 'animate-pulse' : ''
              }`}
              style={
                p.highlight_style === 'ribbon'
                  ? {
                      background: '#1a1a1a',
                      color: '#D4AF37',
                      letterSpacing: '0.08em',
                      borderLeft: '2px solid #D4AF37',
                      borderRadius: '4px',
                    }
                  : p.highlight_style === 'glow'
                    ? {
                        background: 'linear-gradient(135deg, #fff8e7, #fff3d0)',
                        color: '#b8860b',
                        border: '1px solid #D4AF3755',
                        letterSpacing: '0.06em',
                        boxShadow: '0 0 10px rgba(212,175,55,0.2)',
                      }
                    : {
                        background: 'linear-gradient(135deg, #D4AF37, #f5d77a, #D4AF37)',
                        color: '#3d2200',
                        letterSpacing: '0.06em',
                        boxShadow: '0 2px 6px rgba(212,175,55,0.25)',
                      }
              }
            >
              {p.highlight_style !== 'ribbon' && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill={p.highlight_style === 'glow' ? 'none' : '#3d2200'} stroke={p.highlight_style === 'glow' ? '#b8860b' : 'none'} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
              {p.highlight_label}
            </span>
          )}
        </div>

        <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2 flex-1">{p.description}</p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goProgram();
          }}
          data-testid={`dashboard-know-more-${p.id}`}
          className="mb-3 w-full sm:w-auto inline-flex items-center justify-center bg-[#1a1a1a] hover:bg-[#333] text-white py-2 px-6 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
        >
          Know More
        </button>

        {enrollStatus === 'open' && !subscriberIsAnnual && hasTiers && (
          <div data-testid={`dashboard-tier-selector-${p.id}`} className="mb-3">
            <div className={`grid ${tierGridClass} gap-1`}>
              {tiers.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  title={t.label || undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalTier(i);
                  }}
                  className={`min-h-[2.25rem] px-1.5 text-[10px] leading-tight rounded-full border transition-all flex items-center justify-center text-center ${
                    localTier === i ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]'
                  }`}
                >
                  <span className="line-clamp-2 break-words">{compactTierButtonLabel(t.label)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {enrollStatus === 'open' &&
          !subscriberIsAnnual &&
          offerPrice > 0 &&
          deadline &&
          (() => {
            const dl = new Date(deadline);
            if (dl <= new Date()) return null;
            const diff = dl - Date.now();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return (
              <div
                data-testid={`dashboard-early-bird-${p.id}`}
                className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 animate-pulse"
              >
                <Bell size={14} className="text-red-500 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-red-600">{p.offer_text || 'Early Bird'}</span>
                  <span className="text-red-500 ml-1.5">
                    ends in {days}d {hours}h {mins}m
                  </span>
                </div>
              </div>
            );
          })()}

        {enrollStatus === 'open' && !subscriberIsAnnual && (
            <div className="mt-auto pt-4 border-t border-gray-100">
              {showContact ? (
                <div className="text-center mb-2">
                  <p className="text-gray-500 text-[10px] mb-1.5">Custom pricing</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/contact?program=${p.id}&title=${encodeURIComponent(p.title)}&tier=Annual`);
                    }}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-full text-[10px] tracking-wider transition-colors uppercase font-medium"
                  >
                    Contact for Pricing
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                    {showSpecialPromo ? (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xl font-bold text-[#D4AF37] tabular-nums">
                            {symbol} {afterPromo.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 line-through tabular-nums">
                            {symbol} {baseForPromo.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-violet-700 font-medium">
                          With {promoForProgramClicks} (on offer price)
                        </span>
                        {offerPrice > 0 && price > offerPrice && (
                          <span className="text-[10px] text-gray-400">List {symbol}{price.toLocaleString()}</span>
                        )}
                      </div>
                    ) : offerPrice > 0 ? (
                      <>
                        <span className="text-xl font-bold text-[#D4AF37] tabular-nums">
                          {symbol} {offerPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 line-through tabular-nums">
                          {symbol} {price.toLocaleString()}
                        </span>
                      </>
                    ) : price > 0 ? (
                      <span className="text-xl font-bold text-gray-900 tabular-nums">
                        {symbol} {price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xl font-bold text-green-600">FREE</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {price > 0 && (
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={inCart || justAdded}
                        className={`flex items-center justify-center px-2.5 py-2 rounded-full text-[10px] transition-all font-medium border ${
                          inCart || justAdded
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                        }`}
                        aria-label="Add to cart"
                      >
                        {inCart || justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/enroll/program/${p.id}?tier=${tierIdxForDisplay}`);
                      }}
                      className="flex-1 min-w-[7rem] bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
                    >
                      {price > 0 ? 'Enroll Now' : 'Register Free'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Tap the image to add this program to your cart with the tier selected above.
                  </p>
                </>
              )}
            </div>
        )}

        {enrollStatus === 'closed' && (
          <div className="mt-auto pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled
              className="w-full bg-gray-300 text-gray-500 py-2 rounded-full text-[10px] tracking-wider uppercase font-medium cursor-not-allowed"
            >
              {p.closure_text || 'Closed'}
            </button>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
