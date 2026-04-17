import React from 'react';

function roundPortalSeat(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

/** Per-seat portal preview (annual subscribers): matches Admin dashboard offer buckets. */
export function DashboardUpcomingPortalPricing({ symbol, preview }) {
  if (!preview || preview.loading) {
    return <p className="text-xs text-slate-400">Loading portal prices…</p>;
  }
  if (preview.error) {
    return <p className="text-xs text-slate-400">Could not load prices</p>;
  }
  const { annualSeat, householdSeat, extendedSeat, included } = preview;
  const a = annualSeat === 'included' ? null : roundPortalSeat(annualSeat);
  const h = roundPortalSeat(householdSeat);
  const e = roundPortalSeat(extendedSeat);

  if (a != null && h != null && e != null && a === h && h === e) {
    return (
      <div className="text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#b8860b] mb-1">Portal (each seat)</p>
        <p className="text-lg font-semibold text-slate-900 tabular-nums">
          {symbol}
          {a.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">Same for annual, household &amp; friends</p>
      </div>
    );
  }

  if (included && h != null && e != null && h === e) {
    return (
      <div className="text-left space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#b8860b]">Your seat</p>
        <p className="text-sm font-semibold text-emerald-800">Included in package</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 pt-1">Each guest seat</p>
        <p className="text-lg font-semibold text-slate-900 tabular-nums">
          {symbol}
          {h.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500">Household &amp; friends — same rate</p>
      </div>
    );
  }

  return (
    <div className="text-left space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#b8860b]">Portal seat prices (each)</p>
      {included ? (
        <p className="text-sm text-slate-800">
          <span className="text-slate-500">Annual member:</span>{' '}
          <span className="font-semibold text-emerald-800">Included</span>
        </p>
      ) : (
        <p className="text-sm text-slate-800">
          <span className="text-slate-500">Annual member:</span>{' '}
          <span className="font-semibold tabular-nums">{a != null ? `${symbol}${a.toLocaleString()}` : '—'}</span>
        </p>
      )}
      <p className="text-sm text-slate-800">
        <span className="text-slate-500">Household:</span>{' '}
        <span className="font-semibold tabular-nums">{h != null ? `${symbol}${h.toLocaleString()}` : '—'}</span>
      </p>
      <p className="text-sm text-slate-800">
        <span className="text-slate-500">Friends &amp; extended:</span>{' '}
        <span className="font-semibold tabular-nums">{e != null ? `${symbol}${e.toLocaleString()}` : '—'}</span>
      </p>
      {(h == null || e == null) && (
        <p className="text-xs text-slate-400 pt-0.5 leading-snug">
          Save at least one contact in each list (below) to preview prices for seats you haven&apos;t added yet.
        </p>
      )}
    </div>
  );
}
