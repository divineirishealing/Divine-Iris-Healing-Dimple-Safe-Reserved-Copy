import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Clock,
  Bell,
  BellOff,
  ShoppingCart,
  Loader2,
  Monitor,
  Wifi,
  ChevronDown,
} from 'lucide-react';
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
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  buildFullPortalRosterCartParticipants,
  buildSelfOnlyCartParticipants,
} from '../../lib/dashboardCartPrefill';
import { getAuthHeaders } from '../../lib/authHeaders';

const API_ROOT = process.env.REACT_APP_BACKEND_URL;

/** Portal quote: list layout, or compact “offer per person” under Pricing & offer. */
function AnnualQuoteBreakdown({ aq, symbol, includedPkg, suppressIntro = false, layout = 'list' }) {
  if (!aq) {
    return <p className="text-[11px] text-slate-500 italic">Calculating total…</p>;
  }
  const imm = Number(aq.immediate_family_count || 0);
  const ext = Number(aq.extended_guest_count || 0);
  const showSelf = !includedPkg && aq.include_self !== false;

  const selfStrike =
    !includedPkg && Number(aq.self_unit) > Number(aq.self_after_promos ?? 0) ? (
      <span className="text-slate-400 line-through tabular-nums">
        {symbol}
        {Number(aq.self_unit).toLocaleString()}
      </span>
    ) : null;

  if (layout === 'table') {
    const selfOffer = Number(aq.self_after_promos ?? 0);
    const immOfferEach = imm > 0 ? Number(aq.immediate_family_after_promos ?? 0) / imm : null;
    const extOfferEach = ext > 0 ? Number(aq.extended_guests_after_promos ?? 0) / ext : null;
    const rowClass = 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] text-slate-800';
    return (
      <div className="text-[11px] text-slate-800 leading-snug w-full min-w-0 space-y-2">
        {!suppressIntro ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Offer price per person (portal)
          </p>
        ) : null}
        <div className="rounded-md border border-slate-200 bg-white w-full px-3 py-2.5 space-y-2">
          {includedPkg ? (
            <div className={rowClass}>
              <span className="text-slate-700">Your seat</span>
              <span className="text-slate-600 text-right">Included in annual package</span>
            </div>
          ) : null}
          {showSelf ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">You (annual member)</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {symbol}
                {selfOffer.toLocaleString()}
                <span className="text-slate-500 font-normal text-[10px] ml-1">per person</span>
              </span>
            </div>
          ) : null}
          {imm > 0 ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">Immediate family</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {symbol}
                {Math.round(immOfferEach ?? 0).toLocaleString()}
                <span className="text-slate-500 font-normal text-[10px] ml-1">per person</span>
              </span>
            </div>
          ) : null}
          {ext > 0 ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">Friends &amp; extended</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {symbol}
                {Math.round(extOfferEach ?? 0).toLocaleString()}
                <span className="text-slate-500 font-normal text-[10px] ml-1">per person</span>
              </span>
            </div>
          ) : null}
          {!includedPkg && !showSelf && imm === 0 && ext === 0 ? (
            <p className="text-[11px] text-slate-500">Select family members to see offer pricing for guests.</p>
          ) : null}
          {includedPkg && imm === 0 && ext === 0 ? (
            <p className="text-[11px] text-slate-500">Select who is joining to see offer price per guest seat.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-[11px] text-slate-700 leading-snug">
      {!suppressIntro ? (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Prices — Annual member · Immediate family · Friends &amp; extended
          </p>
          <p className="font-semibold text-slate-900 text-xs">Calculate total amount</p>
        </>
      ) : null}
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
 * Annual = row: program card | stacked pricing (collapsible), family (collapsible), attendance (collapsible) + pay.
 */
export default function DashboardUpcomingProgramRowItem({
  program: p,
  isAnnual: subscriberIsAnnual,
  bookerEmail = '',
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
  openEnrollmentSeatModal,
  annualSeatUi = null,
}) {
  const navigate = useNavigate();
  const { syncProgramLineItem } = useCart();
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
  const canAddToDivineCart = subscriberIsAnnual
    ? Boolean(aq && aq.total > 0 && (!includedPkg || selCount >= 1))
    : Boolean(enrollStatus === 'open' && !showContact);

  const [addingToCheckout, setAddingToCheckout] = useState(false);
  const [annualPricingOpen, setAnnualPricingOpen] = useState(true);
  const [annualFamilyOpen, setAnnualFamilyOpen] = useState(true);
  const [annualAttendanceOpen, setAnnualAttendanceOpen] = useState(true);

  const syncThisProgramToDivineCart = async () => {
    let participants = null;
    try {
      const r = await axios.get(`${API_ROOT}/api/student/enrollment-prefill`, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      const pre = r.data || {};
      const self = pre.self;
      if (subscriberIsAnnual) {
        participants = buildAnnualDashboardCartParticipants({
          program: p,
          includedPkg,
          selectedMemberIds: selIds,
          seatDraft: annualSeatUi?.draft,
          enrollableGuests,
          self,
          bookerEmail,
          detectedCountry,
          immediateFamilyMembers: members,
        });
      } else {
        participants =
          buildFullPortalRosterCartParticipants(p, pre, bookerEmail, detectedCountry) ||
          buildSelfOnlyCartParticipants(self, p, bookerEmail, detectedCountry);
      }
    } catch {
      /* empty row */
    }
    const guestBucketById = buildGuestBucketByIdFromSelection(selIds, members);
    syncProgramLineItem(p, tierIdxForDisplay, participants, {
      familyIds: selIds.map(String),
      bookerJoins: includedPkg ? false : annualSeatUi?.draft?.bookerJoinsProgram !== false,
      /** Must match dashboard / quote: annual add-ons were always false here before, so Divine Cart used title heuristics and dropped real lines. */
      annualIncluded: !!includedPkg,
      portalQuoteTotal: aq?.total != null ? Number(aq.total) : null,
      guestBucketById,
    });
  };

  const goProgram = () => navigate(`/program/${p.id}`);

  const handleAddToDivineCart = async (e) => {
    e.stopPropagation();
    setAddingToCheckout(true);
    try {
      await syncThisProgramToDivineCart();
      toast({
        title: 'Order updated',
        description: `${p.title || 'Program'} is in your order. Click DIVINE CART in the sidebar when you are ready to review and pay.`,
      });
    } finally {
      setAddingToCheckout(false);
    }
  };

  const heroClick = () => {
    if (enrollStatus === 'open') goProgram();
  };

  const tierGridClass =
    tiers.length <= 1 ? 'grid-cols-1' : tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  const outerShellClass = subscriberIsAnnual
    ? `w-full mr-auto transition-all duration-300 ${enrollStatus === 'closed' ? 'opacity-60' : ''}`
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
        aria-label={enrollStatus === 'open' ? `Open ${p.title || 'program'}` : `${p.title || 'program'}`}
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
        <div className="w-full flex flex-col xl:flex-row xl:items-stretch gap-4 xl:gap-4">
          {/* 1 — Same footprint as non-annual dashboard card: vertical max-w-md (~28rem) */}
          <div
            className={`group bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 flex flex-col w-full max-w-md xl:w-[28rem] xl:max-w-[28rem] xl:shrink-0 mx-auto xl:mx-0 min-h-0 ${
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
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                      <Bell size={14} className="text-red-500 flex-shrink-0" />
                      <div className="text-xs leading-snug min-w-0">
                        <span className="font-bold text-red-600 uppercase tracking-wide">{p.offer_text || 'Exclusive'}</span>
                        <span className="text-red-600 ml-1.5">
                          ends in {days}d {hours}h {mins}m
                        </span>
                      </div>
                    </div>
                  );
                })()}
              <div className="flex flex-wrap items-baseline gap-2 mb-1 mt-auto">
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
                    {offerPrice > 0 && price > offerPrice ? (
                      <span className="text-[10px] text-gray-400">List {symbol}
                        {price.toLocaleString()}
                      </span>
                    ) : null}
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
              {aq ? (
                <p className="text-[11px] text-slate-600 mb-2 leading-snug">
                  Your selection total{includedPkg ? ' (guests & add-ons)' : ''}:{' '}
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {symbol} {Number(aq.total ?? 0).toLocaleString()}
                  </span>
                </p>
              ) : subscriberIsAnnual ? (
                <p className="text-[11px] text-slate-500 italic mb-2">Loading portal total…</p>
              ) : null}
              {enrollStatus === 'open' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goProgram();
                  }}
                  data-testid={`dashboard-know-more-annual-${p.id}`}
                  className="mt-auto w-full inline-flex items-center justify-center bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 px-6 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
                >
                  Know More
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-auto w-full bg-gray-300 text-gray-500 py-2 rounded-full text-[10px] tracking-wider uppercase font-medium cursor-not-allowed"
                >
                  {p.closure_text || 'Closed'}
                </button>
              )}
            </div>
          </div>

                   {/* 2 — Pricing & offer, Family to join, Attendance & checkout (stacked); cart at bottom aligns with Know More on xl */}
          <div className="flex flex-col gap-4 flex-1 min-w-0 w-full min-h-0">
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-h-0 flex flex-col min-w-0 w-full">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40"
                onClick={() => setAnnualPricingOpen((o) => !o)}
                aria-expanded={annualPricingOpen}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Pricing &amp; offer</span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${annualPricingOpen ? '' : '-rotate-90'}`}
                  aria-hidden
                />
              </button>
              {annualPricingOpen ? (
                <div className="min-w-0 w-full pt-2">
                  <AnnualQuoteBreakdown aq={aq} symbol={symbol} includedPkg={includedPkg} suppressIntro layout="table" />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] gap-3 lg:gap-x-3 items-start w-full min-w-0">
              <div className="rounded-xl border border-amber-100/80 bg-amber-50/25 p-3 sm:p-4 min-h-0 flex flex-col min-w-0 w-full">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                onClick={() => setAnnualFamilyOpen((o) => !o)}
                aria-expanded={annualFamilyOpen}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Family to join</span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${annualFamilyOpen ? '' : '-rotate-90'}`}
                  aria-hidden
                />
              </button>
              {annualFamilyOpen ? (
                <>
            {annualSeatUi && !includedPkg ? (
              <div className="mb-3 pb-3 border-b border-amber-200/70">
                <label className="flex items-start gap-2 cursor-pointer text-[10px] text-slate-800 leading-snug">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 mt-0.5 shrink-0"
                    checked={annualSeatUi.draft?.bookerJoinsProgram !== false}
                    onChange={(e) => {
                      e.stopPropagation();
                      annualSeatUi.onPatchDraft(p.id, { bookerJoinsProgram: e.target.checked });
                    }}
                  />
                  <span className="font-semibold text-slate-900">I am enrolling myself</span>
                </label>
              </div>
            ) : null}
            <div className="flex flex-col gap-4 flex-1 min-h-0 max-h-[min(26rem,55vh)] overflow-y-auto pr-1 pt-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Immediate family</p>
                {enrollableGuests.length === 0 ? (
                  <p className="text-xs text-slate-500">Add people under the lists below, then save.</p>
                ) : (
                  <div className="space-y-2">
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
              <div className="min-w-0 pt-1 border-t border-amber-200/50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Friends &amp; extended</p>
                {otherMembers.length > 0 ? (
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
                </>
              ) : null}
              </div>

            {/* Attendance & notification — column beside family; defaults + cart sit below full width */}
            <div className="w-full max-w-full rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm min-w-0 flex flex-col lg:justify-self-start">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40"
                onClick={() => setAnnualAttendanceOpen((o) => !o)}
                aria-expanded={annualAttendanceOpen}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Attendance &amp; notification</span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${annualAttendanceOpen ? '' : '-rotate-90'}`}
                  aria-hidden
                />
              </button>
              {annualAttendanceOpen ? (
                <div className="flex flex-col gap-2 w-full min-w-0 pt-2">
                {annualSeatUi && (!includedPkg || selCount >= 1) ? (
                  <div
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                    data-testid={`dashboard-compact-seat-${p.id}`}
                  >
                <p className="text-[10px] text-slate-600 leading-snug mb-1.5">
                  <span className="font-semibold text-slate-800">Attendance &amp; notification</span> are{' '}
                  <span className="font-semibold text-slate-800">the same for every upcoming program</span> — change them
                  once here (or in the advanced modal) and they stay in sync across all cards. You can save these as
                  defaults for this browser.
                </p>
                {annualSeatUi.draft?.enrollmentDefaultsLoaded ? (
                  <p className="text-[9px] text-violet-900 bg-violet-50 border border-violet-200/70 rounded px-2 py-1 leading-snug mb-2 w-full">
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

                <div className="w-full flex flex-col gap-0 divide-y divide-slate-200">
                  <div className="flex flex-col gap-1.5 py-2 first:pt-0 w-full">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 shrink-0">
                      Attendance
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                      {annualSeatUi.attendanceQuickPreset === 'custom' ? (
                        <span className="text-[9px] text-amber-800/90">Mixed — use advanced or pick a preset.</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 py-2 w-full">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 shrink-0 leading-snug">
                      Enrollment email
                    </span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
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
                      {annualSeatUi.notifyQuickPreset === 'mixed' ? (
                        <span className="text-[9px] text-amber-800/90">Mixed — open advanced.</span>
                      ) : null}
                    </div>
                  </div>

                                   {!includedPkg ? (
                    annualSeatUi.attendanceQuickPreset === 'custom' ||
                    annualSeatUi.notifyQuickPreset === 'mixed' ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[10px] text-slate-700">
                        <span className="font-semibold text-slate-600 shrink-0 uppercase text-[9px] tracking-wide">
                          Your seat
                        </span>
                        <span className="truncate max-w-[12rem] font-medium text-slate-800">
                          {annualSeatUi.bookerDisplayName}
                        </span>
                        <label className="inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap">
                          <input
                            type="radio"
                            name={`dash-inline-booker-${p.id}`}
                            checked={(annualSeatUi.draft?.bookerSeatMode || 'online') !== 'offline'}
                            onChange={() => annualSeatUi.onPatchDraft(p.id, { bookerSeatMode: 'online' })}
                          />
                          <Wifi size={11} className="text-slate-500" />
                          Online
                        </label>
                        <label className="inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap">
                          <input
                            type="radio"
                            name={`dash-inline-booker-${p.id}`}
                            checked={(annualSeatUi.draft?.bookerSeatMode || 'online') === 'offline'}
                            onChange={() => annualSeatUi.onPatchDraft(p.id, { bookerSeatMode: 'offline' })}
                          />
                          <Monitor size={11} className="text-slate-500" />
                          Offline
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer whitespace-nowrap">
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
                    ) : (
                      <p className="text-[9px] text-slate-500 py-2 leading-snug border-t border-slate-100">
                        <span className="font-medium text-slate-600">Your seat</span> ({annualSeatUi.bookerDisplayName}) is set
                        by the <strong className="font-medium text-slate-700">Attendance</strong> and{' '}
                        <strong className="font-medium text-slate-700">Enrollment email</strong> rows above — those controls
                        already update your own mode and email. The extra row only appears when choices are mixed (then you
                        can fine-tune here or open{' '}
                        <strong className="font-semibold text-slate-700 uppercase tracking-wide text-[9px]">
                          Per-person attendance &amp; email
                        </strong>{' '}
                        on this card).
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            ) : null}
                </div>
              ) : null}
            </div>

            </div>

            {subscriberIsAnnual && annualSeatUi ? (
              <div
                className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm flex flex-col gap-2"
                data-testid={`dashboard-enrollment-defaults-${p.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 w-full min-w-0">
                  <button
                    type="button"
                    className="text-violet-700 font-bold uppercase tracking-wide text-[9px] underline underline-offset-2 hover:text-violet-900 p-0 bg-transparent border-0 cursor-pointer text-left shrink-0 sm:pt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      annualSeatUi.onOpenPerPersonSeatModal?.();
                    }}
                  >
                    Per-person attendance &amp; email…
                  </button>
                  <p className="text-[10px] text-slate-500 leading-snug flex-1 min-w-0 sm:max-w-[min(100%,32rem)]">
                    Opens the full editor for <span className="font-medium text-slate-700">{p.title || 'this program'}</span>.
                    Use <strong className="text-slate-700">Save defaults &amp; close</strong> in the dialog if you only want to store preferences.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 scale-90 shrink-0"
                    checked={!!annualSeatUi.persistEnrollmentDefaultsOnContinue}
                    onChange={(e) => annualSeatUi.onPersistEnrollmentDefaultsChange?.(e.target.checked)}
                  />
                  <span className="font-semibold text-[9px] text-slate-800 uppercase tracking-wide leading-snug">
                    Save as my default for every program (this browser)
                  </span>
                </label>
              </div>
            ) : null}

            <div className="w-full pt-3 border-t border-slate-100 mt-auto">
              {enrollStatus === 'open' ? (
                <button
                  type="button"
                  disabled={!canAddToDivineCart || addingToCheckout}
                  title={
                    !canAddToDivineCart
                      ? subscriberIsAnnual
                        ? includedPkg && selCount < 1
                          ? 'Select family members to join or wait for pricing.'
                          : !aq
                            ? 'Loading pricing…'
                            : (aq.total || 0) <= 0
                              ? 'No amount due for this selection.'
                              : ''
                        : showContact
                          ? 'Use contact for pricing for this program.'
                          : enrollStatus !== 'open'
                            ? 'Enrollment is closed.'
                            : ''
                      : undefined
                  }
                  onClick={handleAddToDivineCart}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-6 text-[10px] tracking-wider uppercase font-medium transition-all duration-300 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                  aria-label="Add to Divine Cart"
                  data-testid={`dashboard-divine-cart-${p.id}`}
                >
                  {addingToCheckout ? (
                    <Loader2 size={16} className="animate-spin shrink-0" />
                  ) : (
                    <ShoppingCart size={16} className="shrink-0" />
                  )}
                  Add to Divine Cart
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-6 text-[10px] tracking-wider uppercase font-medium bg-gray-300 text-gray-500 cursor-not-allowed shadow-sm"
                  aria-label="Add to Divine Cart"
                  data-testid={`dashboard-divine-cart-${p.id}`}
                >
                  <ShoppingCart size={16} className="shrink-0 opacity-70" />
                  Add to Divine Cart
                </button>
              )}
            </div>
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
                  <button
                    type="button"
                    disabled={!canAddToDivineCart || addingToCheckout}
                    title={
                      !canAddToDivineCart
                        ? showContact
                          ? 'Use contact for pricing for this program.'
                          : enrollStatus !== 'open'
                            ? 'Enrollment is closed.'
                            : ''
                        : undefined
                    }
                    onClick={handleAddToDivineCart}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none text-white py-2.5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
                    aria-label="Add to Divine Cart"
                    data-testid={`dashboard-divine-cart-${p.id}`}
                  >
                    {addingToCheckout ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : (
                      <ShoppingCart size={14} className="shrink-0" />
                    )}
                    Add to Divine Cart
                  </button>
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Tap the image to open the program page. Use <strong className="text-slate-700 font-medium">Add to Divine Cart</strong> to add this tier to your order; click <strong className="text-slate-700 font-medium">DIVINE CART</strong> in the sidebar when you want to review and pay.
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
