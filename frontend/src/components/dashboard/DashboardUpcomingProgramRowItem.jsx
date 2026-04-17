import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Bell, ShoppingCart, Check, CreditCard, Loader2 } from 'lucide-react';
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

/**
 * One upcoming program row: homepage-style hero (image + overlays + countdown) and card body.
 * Layout is row-wise on large screens; fonts slightly larger than the public grid cards for clarity.
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

  return (
    <div
      className={`group bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100/90 flex flex-col transition-all duration-300 hover:shadow-xl ${
        enrollStatus === 'closed' ? 'opacity-[0.88]' : ''
      }`}
      data-testid={`dashboard-upcoming-${p.id}`}
    >
      {/* Hero — shorter strip; full width above copy */}
      <div
        className={`relative h-36 sm:h-40 md:h-44 w-full shrink-0 overflow-hidden ${
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
            enrollStatus === 'open' ? 'group-hover:scale-[1.04]' : enrollStatus === 'closed' ? 'grayscale-[35%]' : ''
          }`}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop';
          }}
        />

        {enrollStatus === 'open' ? (
          <>
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 max-w-[46%]">
              {p.enable_online !== false && (
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold shadow-md bg-blue-500 text-white w-fit leading-snug">
                  Online (Zoom)
                </span>
              )}
              {p.enable_offline !== false && (
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold shadow-md bg-teal-600 text-white w-fit leading-snug">
                  Offline (Remote, Not In-Person)
                </span>
              )}
              {p.enable_in_person && (
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold shadow-md bg-teal-700 text-white w-fit leading-snug">
                  In-Person
                </span>
              )}
            </div>

            {datetimeBadges.length > 0 && (
              <div
                className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1 max-w-[54%]"
                data-testid={`dashboard-hero-datetime-${p.id}`}
              >
                {datetimeBadges.map((row, idx) =>
                  row.type === 'duration' ? (
                    <span
                      key={idx}
                      className="bg-[#D4AF37] backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md shadow-md tracking-wide"
                    >
                      {row.text}
                    </span>
                  ) : (
                    <span
                      key={idx}
                      className="bg-black/60 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                    >
                      {row.type === 'clock' ? (
                        <Clock size={11} className="flex-shrink-0 opacity-95" />
                      ) : (
                        <Calendar size={11} className="flex-shrink-0 opacity-95" />
                      )}
                      <span className="text-left leading-snug">{row.text}</span>
                    </span>
                  )
                )}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2.5 py-2 pt-7">
              <div className="flex items-end justify-between gap-3">
                <div className="flex-shrink-0 min-w-0">
                  {deadline && <CountdownTimer deadline={deadline} />}
                </div>
                {p.exclusive_offer_enabled && p.exclusive_offer_text && (
                  <span
                    data-testid={`dashboard-exclusive-offer-${p.id}`}
                    className="bg-red-600 text-white text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full shadow-lg tracking-wide uppercase text-right leading-snug max-w-[55%]"
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

      {/* Body — below hero: title, write-up, Know more, then actions */}
      <div className="flex-1 min-w-0 flex flex-col p-4 md:p-5">
        <p className="text-[#D4AF37] text-[11px] sm:text-xs tracking-[0.14em] mb-1 uppercase font-semibold">
          {p.category || 'Program'}
        </p>
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <h3 className="font-[family-name:'Cinzel',serif] text-lg sm:text-xl font-semibold text-gray-900 leading-snug pr-1">
            {p.title}
          </h3>
          {hasTiers && tierIsYearLong && (
            <span className="flex-shrink-0 inline-flex items-center rounded-md border border-[#D4AF37]/45 bg-amber-50/95 text-[10px] font-bold uppercase tracking-wider text-[#6b5210] px-2 py-0.5">
              Annual
            </span>
          )}
          {p.highlight_label && (
            <span
              data-testid={`dashboard-highlight-${p.id}`}
              className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${
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
                <svg width="9" height="9" viewBox="0 0 24 24" fill={p.highlight_style === 'glow' ? 'none' : '#3d2200'} stroke={p.highlight_style === 'glow' ? '#b8860b' : 'none'} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
              {p.highlight_label}
            </span>
          )}
        </div>

        <p className="text-slate-600 text-sm sm:text-[0.9375rem] leading-relaxed mb-3 line-clamp-4">{p.description}</p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goProgram();
          }}
          data-testid={`dashboard-know-more-${p.id}`}
          className="mb-4 w-full sm:w-auto inline-flex items-center justify-center bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 px-8 rounded-full text-xs sm:text-sm tracking-wider transition-all uppercase font-semibold shadow-sm"
        >
          Know More
        </button>

        {enrollStatus === 'open' && !subscriberIsAnnual && hasTiers && (
          <div data-testid={`dashboard-tier-selector-${p.id}`} className="mb-4">
            <div className={`grid ${tierGridClass} gap-2`}>
              {tiers.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  title={t.label || undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalTier(i);
                  }}
                  className={`min-h-[2.5rem] px-2 text-[11px] sm:text-xs leading-tight rounded-full border transition-all flex items-center justify-center text-center ${
                    localTier === i ? 'bg-[#D4AF37] text-white border-[#D4AF37] shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]'
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
                className="flex items-center gap-2.5 bg-red-50/95 border border-red-100/90 rounded-xl px-3.5 py-2.5 mb-4"
              >
                <Bell size={16} className="text-red-500 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-bold text-red-700">{p.offer_text || 'Early Bird'}</span>
                  <span className="text-red-600 ml-2">
                    ends in {days}d {hours}h {mins}m
                  </span>
                </div>
              </div>
            );
          })()}

        {subscriberIsAnnual ? (
          <div className="mt-auto pt-4 border-t border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-stretch gap-5 lg:gap-8">
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {includedPkg ? (
                  <p className="text-sm sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                    Your seat is included in your annual package. Select household or friends &amp; extended to add them —
                    amounts are confirmed in the next step.
                  </p>
                ) : (
                  <p className="text-sm sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                    Choose who is joining, then continue. Member and guest pricing is shown when you enroll — nothing to
                    review here.
                  </p>
                )}
              </div>

              <div className="w-full lg:w-[min(100%,20rem)] xl:w-[22rem] shrink-0 rounded-xl border border-amber-100/80 bg-amber-50/25 px-3 py-3 sm:px-4 sm:py-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-2">Family members to join</p>
                {enrollableGuests.length === 0 ? (
                  <p className="text-sm text-slate-500">Add people under the lists below, then save.</p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
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
                        <span>
                          Add all ({selectableFamilyMemberIds.length} saved)
                        </span>
                      </label>
                    ) : null}
                    {members.length > 0 && (
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
                    )}
                    {otherMembers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Friends &amp; extended</p>
                        <ul className="space-y-1.5">
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
                      </div>
                    )}
                  </div>
                )}
                {includedPkg && selCount === 0 && (
                  <p className="text-xs text-amber-900 bg-amber-50/90 rounded-lg px-2 py-2 mt-2 border border-amber-200/80">
                    Select who you are paying for — your seat is already covered.
                  </p>
                )}
                <p className="text-xs text-slate-500 leading-relaxed mt-3">
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
                    openEnrollmentSeatModal(p, includedPkg, selIds);
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] text-white text-sm font-semibold py-2.5 px-4 hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                  data-testid={`dashboard-pay-${p.id}`}
                >
                  {payingProgramId === p.id ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                  Continue to enrollment &amp; payment
                </button>
              </div>
            </div>
          </div>
        ) : (
          enrollStatus === 'open' && (
            <div className="mt-auto pt-4 border-t border-gray-100">
              {showContact ? (
                <div className="text-center mb-2">
                  <p className="text-slate-500 text-sm mb-2">Custom pricing</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/contact?program=${p.id}&title=${encodeURIComponent(p.title)}&tier=Annual`);
                    }}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-full text-xs sm:text-sm tracking-wider transition-colors uppercase font-semibold"
                  >
                    Contact for Pricing
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                    {showSpecialPromo ? (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-2xl font-bold text-[#D4AF37] tabular-nums">
                            {symbol} {afterPromo.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-400 line-through tabular-nums">
                            {symbol} {baseForPromo.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-sm text-violet-700 font-medium">
                          With {promoForProgramClicks} (on offer price)
                        </span>
                        {offerPrice > 0 && price > offerPrice && (
                          <span className="text-xs text-gray-400">List {symbol}{price.toLocaleString()}</span>
                        )}
                      </div>
                    ) : offerPrice > 0 ? (
                      <>
                        <span className="text-2xl font-bold text-[#D4AF37] tabular-nums">
                          {symbol} {offerPrice.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-400 line-through tabular-nums">
                          {symbol} {price.toLocaleString()}
                        </span>
                      </>
                    ) : price > 0 ? (
                      <span className="text-2xl font-bold text-gray-900 tabular-nums">
                        {symbol} {price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold text-green-600">FREE</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {price > 0 && (
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={inCart || justAdded}
                        className={`flex flex-1 min-w-[3rem] items-center justify-center px-3 py-2.5 rounded-full text-xs sm:text-sm font-semibold border transition-all ${
                          inCart || justAdded
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                        }`}
                        aria-label="Add to cart"
                      >
                        {inCart || justAdded ? <Check size={16} /> : <ShoppingCart size={16} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/enroll/program/${p.id}?tier=${tierIdxForDisplay}`);
                      }}
                      className="flex-1 min-w-[9rem] bg-[#D4AF37] hover:bg-[#b8962e] text-white py-2.5 rounded-full text-xs sm:text-sm tracking-wider transition-all uppercase font-semibold"
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
          )
        )}

        {enrollStatus === 'closed' && (
          <div className="mt-auto pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled
              className="w-full bg-gray-200 text-gray-500 py-2.5 rounded-full text-sm tracking-wider uppercase font-semibold cursor-not-allowed"
            >
              {p.closure_text || 'Closed'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
