import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  Clock,
  Bell,
  ShoppingCart,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { useCart, normalizeCartProgramTier } from '../../context/CartContext';
import { useToast } from '../../hooks/use-toast';
import { resolveImageUrl } from '../../lib/imageUtils';
import { buildHomepageStyleDatetimeBadges } from '../../lib/upcomingHomepagePresentation';
import { CountdownTimer, compactTierButtonLabel } from '../UpcomingProgramsSection';
import {
  pickTierIndexForDashboard,
  programIncludedInAnnualPackage,
  promoDiscountAmount,
} from './dashboardUpcomingHelpers';
import { computeCrossSellDiscount } from '../../lib/crossSellPricing';
import {
  buildAnnualDashboardCartParticipants,
  buildGuestBucketByIdFromSelection,
  buildFullPortalRosterCartParticipants,
} from '../../lib/dashboardCartPrefill';
import { getAuthHeaders } from '../../lib/authHeaders';
import { useAuth } from '../../context/AuthContext';

const API_ROOT = process.env.REACT_APP_BACKEND_URL;

/** Ids + emails from Annual Family Club rows — same person can use different id fields across lists. */
function buildAnnualFamilyClubIdentity(peers) {
  const idSet = new Set();
  const emailSet = new Set();
  for (const m of peers || []) {
    if (!m) continue;
    for (const x of [m.id, m._id, m.client_family_id]) {
      if (x != null && String(x).trim()) idSet.add(String(x));
    }
    const em = String(m.email || '').trim().toLowerCase();
    if (em) emailSet.add(em);
  }
  return { idSet, emailSet };
}

function rowMatchesAnnualFamilyClubIdentity(m, identity) {
  if (!m || !identity) return false;
  for (const x of [m.id, m._id, m.client_family_id]) {
    if (x != null && identity.idSet.has(String(x))) return true;
  }
  const em = String(m.email || '').trim().toLowerCase();
  if (em && identity.emailSet.has(em)) return true;
  return false;
}

/** Portal quote: list layout, or compact “offer per person” under Pricing & offer. */
function AnnualQuoteBreakdown({
  aq,
  symbol,
  includedPkg,
  suppressIntro = false,
  layout = 'list',
  /** Client Garden Dashboard Access = Annual — portal offer columns & per-program overrides apply. */
  annualDashboardAccess = false,
  /** Program is on admin annual-package list (MMM, AWRP, …) — used for non-annual payer copy. */
  programOnAnnualPackageList = false,
}) {
  if (!aq) {
    return <p className="text-[11px] text-slate-500 italic">Calculating total…</p>;
  }
  const ahSel = Number(aq.annual_household_peer_selected_count ?? aq.annual_household_peer_count ?? 0);
  const ahPay = Number(aq.annual_household_peer_count ?? 0);
  const ahPkg = Number(
    aq.annual_household_peer_package_included_count ?? Math.max(0, ahSel - ahPay),
  );
  const immOnly =
    aq.immediate_family_only_selected_count != null
      ? Number(aq.immediate_family_only_selected_count)
      : aq.immediate_family_only_count != null
        ? Number(aq.immediate_family_only_count)
        : Math.max(0, Number(aq.immediate_family_count || 0) - ahSel);
  const ext = Number(aq.extended_guest_count || 0);
  const showSelf = !includedPkg && aq.include_self !== false;
  /** Same roster bucket as backend; label matches website parity when not on Annual+Dashboard. */
  const linkedHouseholdLabel = annualDashboardAccess ? 'Annual Family Club' : 'Linked household';

  const selfStrike =
    !includedPkg && Number(aq.self_unit) > Number(aq.self_after_promos ?? 0) ? (
      <span className="text-slate-400 line-through tabular-nums">
        {symbol}
        {Number(aq.self_unit).toLocaleString()}
      </span>
    ) : null;

  if (layout === 'table') {
    const selfOffer = Number(aq.self_after_promos ?? 0);
    const ahOfferEach = ahPay > 0 ? Number(aq.annual_household_after_promos ?? 0) / ahPay : null;
    const immOfferEach = immOnly > 0 ? Number(aq.immediate_family_only_after_promos ?? 0) / immOnly : null;
    const extOfferEach = ext > 0 ? Number(aq.extended_guests_after_promos ?? 0) / ext : null;
    const rowClass = 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] text-slate-800';
    return (
      <div className="text-[11px] text-slate-800 leading-snug w-full min-w-0 space-y-2">
        {!suppressIntro ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {annualDashboardAccess
              ? 'Offer per person — Annual member · Annual Family Club · Immediate family'
              : 'Offer per seat — same published rates as the main website for this tier · You · linked household · immediate family · friends & extended'}
          </p>
        ) : null}
        <div className="rounded-md border border-slate-200 bg-white w-full px-3 py-2.5 space-y-2">
          {!includedPkg &&
          programOnAnnualPackageList &&
          !annualDashboardAccess &&
          ahSel > 0 ? (
            <p className="text-[10px] text-violet-900/90 bg-violet-50/90 border border-violet-100 rounded-md px-2.5 py-1.5 leading-snug">
              This program is on the annual package list. Linked household members with their own Annual+Dashboard
              access may have seats covered by their package — see the household line below.
            </p>
          ) : null}
          {includedPkg ? (
            <div className={rowClass}>
              <span className="text-slate-700">Your seat</span>
              <span className="text-slate-600 text-right">Included in annual package</span>
            </div>
          ) : null}
          {showSelf ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">
                {annualDashboardAccess ? 'You (Annual Member)' : 'You'}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 text-right">
                {symbol}
                {selfOffer.toLocaleString()}
                <span className="text-slate-500 font-normal text-[10px] ml-1">· 1 seat</span>
              </span>
            </div>
          ) : null}
          {ahSel > 0 ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">{linkedHouseholdLabel}</span>
              {includedPkg ? (
                <span className="text-slate-600 text-right">Included in annual package</span>
              ) : ahPay > 0 ? (
                <span className="font-semibold tabular-nums text-slate-900 text-right leading-snug">
                  {symbol}
                  {Math.round(ahOfferEach ?? 0).toLocaleString()} × {ahPay} = {symbol}
                  {Number(aq.annual_household_after_promos ?? 0).toLocaleString()}
                  {ahPkg > 0 ? (
                    <span className="block text-[10px] font-normal text-slate-600 mt-0.5">
                      {ahPkg} seat{ahPkg !== 1 ? 's' : ''} included (peer annual package)
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-slate-600 text-right leading-snug">
                  {ahPkg > 0 ? (
                    <>
                      {ahPkg} seat{ahPkg !== 1 ? 's' : ''} included in peer annual package
                    </>
                  ) : (
                    <span className="tabular-nums">
                      {symbol}0 — see Divine Cart for detail
                    </span>
                  )}
                </span>
              )}
            </div>
          ) : null}
          {immOnly > 0 ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">Immediate family</span>
              <span className="font-semibold tabular-nums text-slate-900 text-right leading-snug">
                {symbol}
                {Math.round(immOfferEach ?? 0).toLocaleString()} × {immOnly} = {symbol}
                {Number(aq.immediate_family_only_after_promos ?? aq.immediate_family_after_promos ?? 0).toLocaleString()}
              </span>
            </div>
          ) : null}
          {ext > 0 ? (
            <div className={rowClass}>
              <span className="font-medium text-slate-800">Friends &amp; extended</span>
              <span className="font-semibold tabular-nums text-slate-900 text-right leading-snug">
                {symbol}
                {Math.round(extOfferEach ?? 0).toLocaleString()} × {ext} = {symbol}
                {Number(aq.extended_guests_after_promos ?? 0).toLocaleString()}
              </span>
            </div>
          ) : null}
          {!includedPkg && !showSelf && ahSel === 0 && immOnly === 0 && ext === 0 ? (
            <p className="text-[11px] text-slate-500">Select family members to see offer pricing for guests.</p>
          ) : null}
          {includedPkg && ahSel === 0 && immOnly === 0 && ext === 0 ? (
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
            {annualDashboardAccess
              ? 'Prices — Annual Member · Annual Family Club · Immediate family · Friends & extended'
              : 'Prices — same as the main website for this tier · You · Linked household · Immediate family · Friends & extended'}
          </p>
          <p className="font-semibold text-slate-900 text-xs">Calculate total amount</p>
        </>
      ) : null}
      <ul className="list-none space-y-1.5 pl-0 text-[11px]">
        {includedPkg ? <li className="text-slate-600">Your seat: included in annual package</li> : null}
        {showSelf ? (
          <li>
            {annualDashboardAccess ? 'You (Annual Member)' : 'You'}:{' '}
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
        {ahSel > 0 ? (
          <li className={includedPkg ? 'text-slate-600' : undefined}>
            {linkedHouseholdLabel} × {ahSel}:{' '}
            {includedPkg ? (
              <span className="font-medium text-slate-800">included in annual package</span>
            ) : ahPay > 0 ? (
              <>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {symbol}
                  {Number(aq.annual_household_after_promos ?? 0).toLocaleString()}
                </span>
                {ahPay > 1 ? (
                  <span className="text-slate-500 ml-1">
                    ({symbol}
                    {(Number(aq.annual_household_after_promos) / ahPay).toFixed(0)} each on {ahPay} paid seat
                    {ahPay !== 1 ? 's' : ''})
                  </span>
                ) : null}
                {ahPkg > 0 ? (
                  <span className="text-slate-600 block text-[10px] mt-0.5">
                    {ahPkg} included via peer annual package
                  </span>
                ) : null}
              </>
            ) : ahPkg > 0 ? (
              <span className="font-medium text-slate-800">all included (peer annual package)</span>
            ) : (
              <span className="tabular-nums text-slate-600">{symbol}0</span>
            )}
          </li>
        ) : null}
        {immOnly > 0 ? (
          <li>
            Immediate family × {immOnly}:{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {symbol}
              {Number(aq.immediate_family_only_after_promos ?? aq.immediate_family_after_promos ?? 0).toLocaleString()}
            </span>
            {immOnly > 1 ? (
              <span className="text-slate-500 ml-1">
                ({symbol}
                {(
                  Number(aq.immediate_family_only_after_promos ?? aq.immediate_family_after_promos ?? 0) / immOnly
                ).toFixed(0)}{' '}
                each)
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
  /** Client Garden Dashboard Access = Annual — portal quote applies dashboard offer overlays. */
  annualDashboardAccess = false,
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
  /** Client Garden same-key annual peers (primary-only enrollable); not the manual immediate family list. */
  annualHouseholdPeers = [],
  enrollableGuests,
  selectedFamilyByProgram,
  toggleFamilyMember,
  toggleSelectAllFamilyForProgram,
  openEnrollmentSeatModal,
  annualSeatUi = null,
  enrollmentSelf = null,
  dashboardTierIndex,
  onDashboardTierChange,
  /** Admin cross-sell rules (e.g. AWRP tier → % off another program); same engine as public cart / enrollment. */
  crossSellRules = [],
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { syncProgramLineItem, removeItem, items: cartItems } = useCart();
  const isInCart = cartItems.some((i) => String(i.programId) === String(p.id));
  const { toast } = useToast();

  const tiers = p.duration_tiers || [];
  const hasTiers = p.is_flagship && tiers.length > 0;

  const tierIdxForDisplay =
    typeof dashboardTierIndex === 'number'
      ? dashboardTierIndex
      : pickTierIndexForDashboard(p, annualDashboardAccess) ?? 0;
  const tier = hasTiers ? tiers[tierIdxForDisplay] : null;
  const tierIsYearLong =
    tier &&
    (tier.label.toLowerCase().includes('annual') ||
      tier.label.toLowerCase().includes('year') ||
      tier.duration_unit === 'year');

  const price = getPrice(p, hasTiers ? tierIdxForDisplay : null);
  const offerPrice = getOfferPrice(p, hasTiers ? tierIdxForDisplay : null);
  /** Tier offer when set, else list — matches program page; portal column overlays apply only with Annual+Dashboard access (backend). */
  const dashboardSeatUnit = offerPrice > 0 ? offerPrice : price;
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
  const baseForPromo = dashboardSeatUnit;
  const disc = validated && baseForPromo > 0 ? promoDiscountAmount(validated, baseForPromo, currency) : 0;
  const afterPromo = Math.max(0, baseForPromo - disc);
  const showSpecialPromo = Boolean(promoForProgramClicks && validated && disc > 0 && !promoPricesLoading);

  const cartLinesForCrossSell = useMemo(
    () =>
      (cartItems || [])
        .filter((i) => i.type === 'program')
        .map((i) => ({ programId: i.programId, tierIndex: i.tierIndex })),
    [cartItems],
  );

  /** Program appears on the admin “Annual package — included programs” list (or keyword fallback when list empty). */
  const programOnAnnualPackageList = programIncludedInAnnualPackage(p, annualIncludedIds);
  /** Logged-in user’s own seat is prepaid (Annual dashboard access + program on package list). */
  const includedPkg = Boolean(
    annualDashboardAccess &&
      ((aq?.included_in_annual_package ?? false) || programOnAnnualPackageList),
  );

  const annualFamilyClubIdentity = useMemo(
    () => buildAnnualFamilyClubIdentity(annualHouseholdPeers),
    [annualHouseholdPeers],
  );

  /** Saved immediate-family rows that are not duplicates of Annual Family Club (id variants or same email). */
  const membersNotInAnnualClub = useMemo(
    () =>
      (members || []).filter((m) => m != null && !rowMatchesAnnualFamilyClubIdentity(m, annualFamilyClubIdentity)),
    [members, annualFamilyClubIdentity],
  );

  /** Same-key peers cannot be enrolled as paid add-ons when the program is already in the annual package. */
  const selectableIdsForProgram = useMemo(() => {
    return (enrollableGuests || [])
      .filter((m) => {
        if (!m.id) return false;
        if (includedPkg && rowMatchesAnnualFamilyClubIdentity(m, annualFamilyClubIdentity)) return false;
        return true;
      })
      .map((m) => String(m.id));
  }, [enrollableGuests, includedPkg, annualFamilyClubIdentity]);

  const selIds = selectedFamilyByProgram[p.id] || [];
  const selCount = selIds.length;

  const crossSellDiscount = useMemo(
    () =>
      computeCrossSellDiscount(
        crossSellRules,
        p.id,
        tierIdxForDisplay,
        afterPromo,
        cartLinesForCrossSell,
      ),
    [crossSellRules, p.id, tierIdxForDisplay, afterPromo, cartLinesForCrossSell],
  );

  const bookerPaysForCrossSell = includedPkg ? false : annualSeatUi?.draft?.bookerJoinsProgram !== false;
  const payingSeatsForCrossSell = (bookerPaysForCrossSell ? 1 : 0) + selIds.length;
  const crossSellLineDeduction =
    crossSellDiscount && crossSellDiscount.amount > 0 && payingSeatsForCrossSell > 0
      ? crossSellDiscount.amount * payingSeatsForCrossSell
      : 0;
  const crossUnitAdj = crossSellDiscount?.amount > 0 ? crossSellDiscount.amount : 0;
  const afterPromoXs = Math.max(0, afterPromo - crossUnitAdj);
  const offerPriceXs = offerPrice > 0 ? Math.max(0, offerPrice - crossUnitAdj) : offerPrice;

  const hasPortalTotal = aq != null && typeof aq.total === 'number';
  const bookerEnrollingSelf = annualSeatUi?.draft?.bookerJoinsProgram !== false;
  /**
   * Paying seats: quote total &gt; 0. Guest-only with no one selected yet: allow Update if the line is already
   * in the cart so the booker can remove themselves / clear the line without re-checking the box.
   */
  const canSaveGuestOnlyClear =
    !includedPkg &&
    hasPortalTotal &&
    !bookerEnrollingSelf &&
    selCount === 0 &&
    isInCart;
  /** Included package: total can be 0 (member seat only). Otherwise require a positive quote total, or cart clear path above. */
  const canAddToDivineCart = hasPortalTotal
    ? Boolean(
        (includedPkg && Number(aq.total) >= 0) ||
          (!includedPkg && aq.total > 0) ||
          canSaveGuestOnlyClear,
      )
    : Boolean(enrollStatus === 'open' && !showContact);

  const [addingToCheckout, setAddingToCheckout] = useState(false);
  const [annualPricingOpen, setAnnualPricingOpen] = useState(true);
  const [annualFamilyOpen, setAnnualFamilyOpen] = useState(true);
  const [annualAttendanceOpen, setAnnualAttendanceOpen] = useState(true);

  /** @returns {'synced' | 'removed' | 'noop' | 'noop_profile' | { kind: 'error', detail: string }} */
  const syncThisProgramToDivineCart = async () => {
    let participants = null;
    const emailFallback = String(bookerEmail || user?.email || '').trim();
    try {
      let selfRaw = enrollmentSelf;
      if (!selfRaw) {
        try {
          const r = await axios.get(`${API_ROOT}/api/student/enrollment-prefill`, {
            withCredentials: true,
            headers: getAuthHeaders(),
          });
          selfRaw = (r.data || {}).self;
        } catch {
          selfRaw = null;
        }
      }
      const selfMerged = {
        ...(selfRaw && typeof selfRaw === 'object' ? selfRaw : {}),
        name: String(selfRaw?.name || user?.name || user?.full_name || '').trim(),
        email: String(selfRaw?.email || emailFallback || '').trim(),
      };
      const bookerJoinsSeat = includedPkg ? false : annualSeatUi?.draft?.bookerJoinsProgram !== false;
      if (bookerJoinsSeat && !includedPkg && !selfMerged.email && !selfMerged.name) {
        return 'noop_profile';
      }
      participants = buildAnnualDashboardCartParticipants({
        program: p,
        includedPkg,
        selectedMemberIds: selIds,
        seatDraft: annualSeatUi?.draft,
        enrollableGuests,
        self: selfMerged,
        bookerEmail: emailFallback,
        detectedCountry,
        immediateFamilyMembers: [...(members || []), ...(annualHouseholdPeers || [])],
        programInAnnualPackageList: programOnAnnualPackageList,
      });
    } catch (err) {
      return { kind: 'error', detail: err?.response?.data?.detail || err?.message || 'Network error' };
    }
    const normalizedTier = normalizeCartProgramTier(p, tierIdxForDisplay);
    const existingLine = cartItems.find(
      (i) =>
        i.type === 'program' &&
        String(i.programId) === String(p.id) &&
        normalizeCartProgramTier(i, i.tierIndex) === normalizedTier,
    );
    if (!participants?.length) {
      if (existingLine) {
        removeItem(existingLine.id);
        return 'removed';
      }
      return 'noop';
    }
    const guestBucketById = buildGuestBucketByIdFromSelection(selIds, [
      ...(members || []),
      ...(annualHouseholdPeers || []),
    ]);
    syncProgramLineItem(p, tierIdxForDisplay, participants, {
      familyIds: selIds.map(String),
      bookerJoins: includedPkg ? false : annualSeatUi?.draft?.bookerJoinsProgram !== false,
      /** Must match dashboard / quote: annual add-ons were always false here before, so Divine Cart used title heuristics and dropped real lines. */
      annualIncluded: !!includedPkg,
      portalQuoteTotal: aq?.total != null ? Number(aq.total) : null,
      guestBucketById,
    });
    return 'synced';
  };

  const goProgram = () => navigate(`/program/${p.id}?source=dashboard`);

  const handleAddToDivineCart = async (e) => {
    e.stopPropagation();
    setAddingToCheckout(true);
    try {
      const action = await syncThisProgramToDivineCart();
      if (action?.kind === 'error') {
        toast({
          title: 'Could not reach server',
          description: String(action.detail || 'Check your connection and try again.'),
          variant: 'destructive',
        });
        return;
      }
      if (action === 'synced') {
        toast({
          title: 'Order updated',
          description: `${p.title || 'Program'} is in your order. Click DIVINE CART in the sidebar when you are ready to review and pay.`,
        });
      } else if (action === 'removed') {
        toast({
          title: 'Removed from Divine Cart',
          description: `${p.title || 'Program'} had no seats selected. Add family on the card or check “I am enrolling myself” to add it again.`,
        });
      } else if (action === 'noop_profile') {
        toast({
          title: 'Profile needed',
          description: 'Add a name or email to your account (or refresh) so we can put your seat in Divine Cart.',
          variant: 'destructive',
        });
      } else if (action === 'noop') {
        toast({
          title: 'Cart not updated',
          description: 'No seats were added. If this keeps happening, refresh the page or open DIVINE CART from the sidebar.',
          variant: 'destructive',
        });
      }
    } finally {
      setAddingToCheckout(false);
    }
  };

  const heroClick = () => {
    if (enrollStatus === 'open') goProgram();
  };

  const tierGridClass =
    tiers.length <= 1 ? 'grid-cols-1' : tiers.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  const outerShellClass = `w-full mr-auto transition-all duration-300 ${enrollStatus === 'closed' ? 'opacity-60' : ''}`;

  const heroShellClass = 'relative h-48 w-full shrink-0 overflow-hidden';

  const heroBlock = (
    <div
      className={`${heroShellClass} ${
        enrollStatus === 'open' ? 'cursor-pointer' : ''
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
      {(
        <div className="w-full flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 md:p-5 shadow-sm box-border">
        {/* xl: narrower left column → wider right stack (closer to healing-scene mug on the right) */}
        <div className="w-full flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,24rem)_minmax(18rem,1fr)] xl:items-stretch xl:gap-4 xl:min-h-0">
          {/* 1 — Program card; grid caps width on xl (non-annual still uses max-w-md ~28rem) */}
          <div
            className={`group bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 flex flex-col w-full max-w-md xl:mx-0 xl:w-full xl:max-w-none xl:min-h-0 xl:h-full min-h-0 ${
              enrollStatus === 'closed' ? 'opacity-60' : 'hover:shadow-2xl'
            }`}
          >
            {heroBlock}
            <div className="p-4 flex flex-col flex-1 min-h-0 xl:min-h-0">
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
              {hasTiers && enrollStatus === 'open' && tiers.length > 1 ? (
                <div data-testid={`dashboard-tier-selector-annual-${p.id}`} className="mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Duration / tier</p>
                  <div className={`grid ${tierGridClass} gap-1`}>
                    {tiers.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDashboardTierChange?.(p.id, i);
                        }}
                        title={t.label || undefined}
                        className={`min-h-[2.25rem] px-1.5 text-[10px] leading-tight rounded-full border transition-all flex items-center justify-center text-center ${
                          tierIdxForDisplay === i
                            ? 'bg-[#D4AF37] text-white border-[#D4AF37]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]'
                        }`}
                      >
                        <span className="line-clamp-2 break-words">{compactTierButtonLabel(t.label)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
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
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                {showSpecialPromo ? (
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xl font-bold text-[#D4AF37] tabular-nums">
                        {symbol}{' '}
                        {(crossUnitAdj > 0 ? afterPromoXs : afterPromo).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 line-through tabular-nums">
                        {symbol}{' '}
                        {(crossUnitAdj > 0 ? afterPromo : baseForPromo).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-violet-700 font-medium">
                      With {promoForProgramClicks} (on offer price)
                    </span>
                    {crossUnitAdj > 0 ? (
                      <span className="text-[10px] text-amber-900 font-medium">
                        {crossSellDiscount?.label || 'Bundle'}: −{symbol}
                        {crossUnitAdj.toLocaleString()} vs cart add-ons when combined programs are in your order
                      </span>
                    ) : null}
                    {offerPrice > 0 && price > offerPrice ? (
                      <span className="text-[10px] text-gray-400">List {symbol}
                        {price.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                ) : offerPrice > 0 ? (
                  <>
                    <span className="text-xl font-bold text-[#D4AF37] tabular-nums">
                      {symbol} {(crossUnitAdj > 0 ? offerPriceXs : offerPrice).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 line-through tabular-nums">
                      {symbol} {price.toLocaleString()}
                    </span>
                    {crossUnitAdj > 0 ? (
                      <span className="text-[10px] text-amber-900 font-medium block w-full">
                        {crossSellDiscount?.label || 'Bundle'}: −{symbol}
                        {crossUnitAdj.toLocaleString()}
                      </span>
                    ) : null}
                  </>
                ) : price > 0 ? (
                  <span className="text-xl font-bold text-gray-900 tabular-nums">
                    {symbol} {price.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xl font-bold text-green-600">FREE</span>
                )}
              </div>
              {/* Absorb extra row height on xl so the white card meets the right column bottom */}
              <div className="hidden xl:block flex-1 min-h-0 shrink-0" aria-hidden />
            </div>
          </div>

                   {/* 2 — Pricing & offer, Choose members to join, Attendance & checkout (stacked); cart at bottom aligns with Know More on xl */}
          <div className="flex flex-col gap-4 flex-1 min-w-0 w-full min-h-0 xl:min-h-0 xl:h-full">
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-h-0 flex flex-col min-w-0 w-full max-w-xl">
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
                  {aq ? (
                    <AnnualQuoteBreakdown
                      aq={aq}
                      symbol={symbol}
                      includedPkg={includedPkg}
                      annualDashboardAccess={annualDashboardAccess}
                      programOnAnnualPackageList={programOnAnnualPackageList}
                      suppressIntro
                      layout="table"
                    />
                  ) : (() => {
                    const bookerJoins = annualSeatUi?.draft?.bookerJoinsProgram !== false;
                    const seatPriceBase = showSpecialPromo ? afterPromo : dashboardSeatUnit;
                    const seatPrice =
                      crossUnitAdj > 0 ? Math.max(0, seatPriceBase - crossUnitAdj) : seatPriceBase;
                    const immMemberIds = new Set(
                      [...(members || []), ...(annualHouseholdPeers || [])]
                        .map((m) => (m.id ? String(m.id) : null))
                        .filter(Boolean),
                    );
                    const extMemberIds = new Set(otherMembers.map(m => m.id ? String(m.id) : null).filter(Boolean));
                    const immCount = selIds.filter(id => immMemberIds.has(id)).length;
                    const extCount = selIds.filter(id => extMemberIds.has(id)).length;
                    const immTotal = immCount * seatPrice;
                    const extTotal = extCount * seatPrice;
                    const rowClass = 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] text-slate-800';
                    return (
                      <div className="rounded-md border border-slate-200 bg-white w-full px-3 py-2.5 space-y-2">
                        {showContact ? (
                          <div className={rowClass}>
                            <span className={`text-slate-700 ${!bookerJoins ? 'line-through opacity-50' : ''}`}>Your seat</span>
                            <span className="text-slate-600 text-right">{bookerJoins ? 'Contact for pricing' : <span className="text-slate-400 italic text-[10px]">not enrolling</span>}</span>
                          </div>
                        ) : bookerJoins && seatPrice > 0 ? (
                          <div className={rowClass}>
                            <span className="font-medium text-slate-800">Your seat</span>
                            <span className="font-semibold tabular-nums text-slate-900 text-right">
                              {symbol}{seatPrice.toLocaleString()}
                              {offerPrice > 0 &&
                                price > offerPrice &&
                                !showSpecialPromo && (
                                <span className="text-slate-400 line-through ml-1.5 text-[10px] font-normal">{symbol}{price.toLocaleString()}</span>
                              )}
                              <span className="text-slate-500 font-normal text-[10px] ml-1">· 1 seat</span>
                            </span>
                          </div>
                        ) : bookerJoins ? (
                          <div className={rowClass}>
                            <span className="font-medium text-slate-800">Your seat</span>
                            <span className="font-bold text-green-600">FREE</span>
                          </div>
                        ) : (
                          <div className={`${rowClass} opacity-50`}>
                            <span className="line-through text-slate-600">Your seat</span>
                            <span className="text-slate-400 italic text-[10px]">not enrolling yourself</span>
                          </div>
                        )}
                        {showSpecialPromo && (
                          <div className={`${rowClass} text-[10px] text-violet-700`}>
                            <span>With {promoForProgramClicks} (on offer price)</span>
                          </div>
                        )}
                        {immCount > 0 && (
                          <div className={rowClass}>
                            <span className="font-medium text-slate-800">Immediate family</span>
                            <span className="font-semibold tabular-nums text-slate-900 text-right leading-snug">
                              {symbol}{seatPrice.toLocaleString()} × {immCount} = {symbol}{immTotal.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {extCount > 0 && (
                          <div className={rowClass}>
                            <span className="font-medium text-slate-800">Friends &amp; extended</span>
                            <span className="font-semibold tabular-nums text-slate-900 text-right leading-snug">
                              {symbol}{seatPrice.toLocaleString()} × {extCount} = {symbol}{extTotal.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {immCount === 0 && extCount === 0 && enrollableGuests.length > 0 && (
                          <p className="text-[11px] text-slate-500">Select who is joining to see offer price per guest seat.</p>
                        )}
                        {immCount === 0 && extCount === 0 && enrollableGuests.length === 0 && (
                          <p className="text-[11px] text-slate-500">Add family members to include them in your enrollment.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              {aq ? (
                <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100 leading-snug space-y-1">
                  <p>
                    Your selection total{includedPkg ? ' (guests & add-ons)' : ''}:{' '}
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {symbol}{' '}
                      {Math.max(0, Number(aq.total ?? 0) - crossSellLineDeduction).toLocaleString()}
                    </span>
                  </p>
                  {crossSellLineDeduction > 0 ? (
                    <p className="text-[10px] text-amber-900 font-medium">
                      Includes {crossSellDiscount?.label || 'bundle'} (−{symbol}
                      {crossSellLineDeduction.toLocaleString()})
                    </p>
                  ) : null}
                </div>
              ) : (() => {
                const bookerJoins = annualSeatUi?.draft?.bookerJoinsProgram !== false;
                const seatPriceBase = showSpecialPromo ? afterPromo : dashboardSeatUnit;
                const seatPrice =
                  crossUnitAdj > 0 ? Math.max(0, seatPriceBase - crossUnitAdj) : seatPriceBase;
                const immCount = selIds.filter((id) =>
                  [...(members || []), ...(annualHouseholdPeers || [])].some((m) => String(m.id) === id),
                ).length;
                const extCount = selIds.filter(id => otherMembers.some(m => String(m.id) === id)).length;
                const grandTotal =
                  (price > 0 || offerPrice > 0)
                    ? (bookerJoins ? seatPrice : 0) + (immCount + extCount) * seatPrice
                    : 0;
                const hasGuests = immCount > 0 || extCount > 0;
                return (bookerJoins || hasGuests) ? (
                  <p className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-100 leading-snug">
                    Your selection total{hasGuests ? ' (guests & add-ons)' : ''}:{' '}
                    <span className="font-semibold text-slate-800 tabular-nums">{symbol} {grandTotal.toLocaleString()}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 italic mt-2 pt-2 border-t border-slate-100">
                    Uncheck "I am enrolling myself" to enroll guests only.
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(13rem,1fr)_minmax(13rem,1fr)] gap-3 lg:gap-x-3 items-start w-full min-w-0 flex-1 min-h-0">
              <div className="rounded-xl border border-amber-100/80 bg-amber-50/25 p-3 sm:p-4 min-h-0 flex flex-col min-w-[13rem] w-full">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                onClick={() => setAnnualFamilyOpen((o) => !o)}
                aria-expanded={annualFamilyOpen}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Choose members to join</span>
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
              {annualHouseholdPeers.length > 0 ? (
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-2">
                    {annualDashboardAccess ? 'Annual Family Club' : 'Linked household'}
                  </p>
                  <ul className="space-y-1.5">
                    {annualHouseholdPeers.map((m, gidx) => {
                      const mid = m.id || `ah-${gidx}-${m.name}-${m.email}`;
                      const peerMatchesClub = rowMatchesAnnualFamilyClubIdentity(m, annualFamilyClubIdentity);
                      const peerHasAnnualDash =
                        m?.annual_portal_access != null
                          ? !!m.annual_portal_access
                          : m?.annual_member_dashboard !== false;
                      /** Annual primary + package program: peers aren’t paid add-ons (unchecked, frozen). */
                      const peerFrozenAnnualPrimary = includedPkg && peerMatchesClub;
                      /** Non-annual primary paying for household: peers’ own annual package covers this program (MMM/AWRP list). */
                      const peerSeatPrepaidWhenPrimaryNotAnnual =
                        !annualDashboardAccess &&
                        programOnAnnualPackageList &&
                        peerMatchesClub &&
                        peerHasAnnualDash;
                      const peerFrozen = peerFrozenAnnualPrimary || peerSeatPrepaidWhenPrimaryNotAnnual;
                      const peerChecked = peerFrozenAnnualPrimary
                        ? false
                        : !!m.id && selIds.includes(String(m.id));
                      const showIncludedHint = peerFrozenAnnualPrimary || peerSeatPrepaidWhenPrimaryNotAnnual;
                      return (
                        <li key={mid}>
                          <div
                            className={`flex items-start gap-2 text-sm ${
                              peerFrozen ? 'text-slate-500' : 'text-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 mt-0.5 shrink-0"
                              disabled={peerFrozen || !m.id}
                              aria-disabled={peerFrozen || !m.id}
                              checked={peerChecked}
                              onChange={() =>
                                m.id && !peerFrozen && toggleFamilyMember(p.id, String(m.id))
                              }
                            />
                            <span className={peerFrozen ? 'cursor-not-allowed' : ''}>
                              <span className="font-medium">{m.name || '—'}</span>
                              {m.relationship ? (
                                <span className="text-slate-500"> ({m.relationship})</span>
                              ) : null}
                              {showIncludedHint ? (
                                <span className="block text-[10px] text-violet-800/90 mt-0.5 leading-snug">
                                  {peerSeatPrepaidWhenPrimaryNotAnnual
                                    ? 'Already included in their Annual Package'
                                    : 'Already included in Annual Package'}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <div
                className={
                  annualHouseholdPeers.length > 0
                    ? 'min-w-0 pt-1 border-t border-amber-200/50'
                    : 'min-w-0'
                }
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Immediate family</p>
                {enrollableGuests.length === 0 ? (
                  <p className="text-xs text-slate-500">Add people under the lists below, then save.</p>
                ) : (
                  <div className="space-y-2">
                    {selectableIdsForProgram.length > 0 ? (
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none pb-1 border-b border-slate-200/80">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={
                            selectableIdsForProgram.length > 0 &&
                            selectableIdsForProgram.every((id) => selIds.includes(id))
                          }
                          ref={(el) => {
                            if (!el) return;
                            const some = selectableIdsForProgram.some((id) => selIds.includes(id));
                            const all =
                              selectableIdsForProgram.length > 0 &&
                              selectableIdsForProgram.every((id) => selIds.includes(id));
                            el.indeterminate = some && !all;
                          }}
                          onChange={() => toggleSelectAllFamilyForProgram(p.id, selectableIdsForProgram)}
                        />
                        <span>Add all ({selectableIdsForProgram.length} saved)</span>
                      </label>
                    ) : null}
                    {membersNotInAnnualClub.length > 0 ? (
                      <div>
                        <ul className="space-y-1.5">
                          {membersNotInAnnualClub.map((m, gidx) => {
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
                    ) : (members || []).length > 0 ? (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Everyone in your saved immediate family is already listed under Annual Family Club above.
                      </p>
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

            {/* Attendance & notification — column beside family; shell matches Pricing & offer */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-h-0 flex flex-col min-w-[13rem] w-full">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40"
                onClick={() => setAnnualAttendanceOpen((o) => !o)}
                aria-expanded={annualAttendanceOpen}
              >
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight text-slate-600 whitespace-nowrap">
                  Attendance &amp; notification
                </span>
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
                  <span className="font-semibold text-slate-800">Attendance &amp; notification</span> are set{' '}
                  <span className="font-semibold text-slate-800">for this program only</span>
                  — other upcoming programs keep their own choices. You can save browser defaults from the advanced modal.
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
                      {!includedPkg && selCount >= 1 ? (
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
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-800 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 shrink-0 scale-90"
                          checked={annualSeatUi.attendanceQuickPreset === 'custom'}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) annualSeatUi.onOpenPerPersonSeatModal?.();
                          }}
                        />
                        Custom
                      </label>
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
                          checked={
                            annualSeatUi.notifyQuickPreset === 'custom' ||
                            annualSeatUi.notifyQuickPreset === 'mixed'
                          }
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

                </div>
              </div>
            ) : null}
                </div>
              ) : null}
            </div>

            </div>

            {annualSeatUi ? (
              <div
                className="w-full rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm min-h-0 flex flex-col gap-2 min-w-0"
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
                  <p className="text-[10px] text-slate-500 leading-snug flex-1 min-w-0 sm:max-w-none line-clamp-2">
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

          </div>
        </div>

        {/* Know More + Divine Cart — inside same white shell as grid; inset from cup text */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:items-center sm:justify-between pt-3 mt-1 border-t border-slate-200/70">
          <div className="w-full sm:w-[min(100%,28rem)] xl:w-[min(100%,24rem)] sm:shrink-0">
            {enrollStatus === 'open' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goProgram();
                }}
                data-testid={`dashboard-know-more-annual-${p.id}`}
                className="w-full inline-flex items-center justify-center bg-[#1a1a1a] hover:bg-[#333] text-white py-2.5 px-5 rounded-full text-[10px] tracking-wider transition-all duration-300 uppercase font-medium"
              >
                Know More
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full bg-gray-300 text-gray-500 py-2.5 rounded-full text-[10px] tracking-wider uppercase font-medium cursor-not-allowed"
              >
                {p.closure_text || 'Closed'}
              </button>
            )}
          </div>
          <div className="w-full min-w-0 flex-1">
            {enrollStatus === 'open' ? (
              <button
                type="button"
                disabled={!canAddToDivineCart || addingToCheckout}
                title={
                  !canAddToDivineCart
                    ? hasPortalTotal
                      ? includedPkg && selCount < 1
                        ? 'Select family members to join or wait for pricing.'
                        : !bookerEnrollingSelf && selCount === 0 && !isInCart
                          ? 'Select family guests or check “I am enrolling myself”, then add to Divine Cart.'
                          : (aq.total || 0) <= 0
                            ? 'No amount due for this selection.'
                            : ''
                      : showContact
                        ? 'Use contact for pricing for this program.'
                        : !aq && enrollStatus === 'open'
                          ? 'Loading pricing…'
                          : 'Enrollment is closed.'
                    : canSaveGuestOnlyClear
                      ? 'Remove this program from your cart (no seats selected).'
                      : undefined
                }
                onClick={handleAddToDivineCart}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-5 text-[10px] tracking-wider uppercase font-medium transition-all duration-300 bg-[#D4AF37] text-white hover:bg-[#b8962e] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                aria-label="Add to Divine Cart"
                data-testid={`dashboard-divine-cart-${p.id}`}
              >
                {addingToCheckout ? (
                  <Loader2 size={16} className="animate-spin shrink-0" />
                ) : (
                  <ShoppingCart size={16} className="shrink-0" />
                )}
                {isInCart ? 'Update Divine Cart' : 'Add to Divine Cart'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-5 text-[10px] tracking-wider uppercase font-medium bg-gray-300 text-gray-500 cursor-not-allowed shadow-sm"
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
      )}
    </div>
  );
}
