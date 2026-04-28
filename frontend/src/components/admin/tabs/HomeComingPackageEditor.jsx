import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Save, Trash2 } from 'lucide-react';
import { addMonthsSubscriptionEnd } from '../../../lib/utils';
import { packageTaxDecimal } from '../../../lib/annualPackagePricing';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Same merge as SubscribersTab — fixed Home Coming bundle rows. */
function mergeHomeComingIncludedPrograms(fromDb) {
  const list = Array.isArray(fromDb) ? fromDb : [];
  const lower = (s) => String(s || '').toLowerCase();
  const findLegacy = (pred) => list.find((p) => pred(lower(p.name || '')));
  const legacyAwrp = findLegacy((n) => n.includes('awrp'));
  const legacyMmm = findLegacy((n) => n.includes('money magic') || n.includes('mmm'));
  const legacyTurbo = findLegacy((n) => n.includes('turbo') || n.includes('quarter') || n.includes('meetup'));
  const legacyMeta = findLegacy(
    (n) => n.includes('meta') || n.includes('bi-annual') || (n.includes('download') && !n.includes('turbo'))
  );
  const row = (name, duration_value, duration_unit, leg) => ({
    name,
    program_id: leg?.program_id || '',
    duration_value,
    duration_unit,
    price_per_unit: {},
    offer_per_unit: {},
  });
  return [
    row('AWRP', 12, 'months', legacyAwrp),
    row('Money Magic Multiplier', 6, 'months', legacyMmm),
    row('Turbo Release', 4, 'sessions', legacyTurbo),
    row('Meta Downloads', 2, 'sessions', legacyMeta),
  ];
}

const NumInput = ({ value, onChange, className = '', bold = false }) => (
  <input
    type="text"
    inputMode="decimal"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onFocus={(e) => {
      if (e.target.value === '0') e.target.select();
    }}
    className={`h-7 text-xs w-full px-1 border rounded-md text-right outline-none focus:ring-1 focus:ring-[#D4AF37] font-mono ${bold ? 'font-bold' : ''} ${className}`}
  />
);

/**
 * Home Coming single annual bundle: catalog offer dates, price, optional anchored start day.
 */
export function HomeComingPackageEditor({ pkg, onSave, saving, onDelete, onNewVersion }) {
  const [c, setC] = useState(() => ({
    ...pkg,
    included_programs: mergeHomeComingIncludedPrograms(pkg.included_programs),
  }));
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setC({
      ...pkg,
      included_programs: mergeHomeComingIncludedPrograms(pkg.included_programs),
    });
  }, [pkg]);

  useEffect(() => {
    if (pkg.package_id) {
      axios
        .get(`${API}/admin/subscribers/packages/${pkg.package_id}/stats`)
        .then((r) => setStats(r.data))
        .catch(() => {});
    }
  }, [pkg.package_id]);

  const locked = c.is_locked;
  const set = (k, v) => {
    if (!locked) setC((prev) => ({ ...prev, [k]: v }));
  };
  const toggleLock = () => setC((prev) => ({ ...prev, is_locked: !prev.is_locked }));

  const setTaxPct = (cur, pctStr) => {
    if (locked) return;
    const pct = parseFloat(pctStr);
    const dec = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) / 100 : 0;
    setC((prev) => ({ ...prev, tax_rates: { ...(prev.tax_rates || {}), [cur]: dec } }));
  };

  const setOfferTotal = (cur, v) =>
    setC((prev) => ({ ...prev, offer_total: { ...(prev.offer_total || {}), [cur]: parseFloat(v) || 0 } }));

  const suggestCatalogOfferEndMonths = (months) => {
    if (locked) return;
    setC((prev) => {
      const from = (prev.valid_from || '').trim();
      if (!from) return prev;
      const m = parseInt(months, 10);
      const n = Number.isFinite(m) && m > 0 ? m : 12;
      return {
        ...prev,
        valid_to: addMonthsSubscriptionEnd(from, n),
      };
    });
  };

  const onValidFromChange = (e) => {
    if (locked) return;
    const v = e.target.value;
    setC((prev) => ({ ...prev, valid_from: v }));
  };

  const onDurationMonthsChange = (raw) => {
    if (locked) return;
    const n = parseInt(raw, 10) || 12;
    setC((prev) => ({ ...prev, duration_months: n }));
  };

  const handleSave = () => {
    onSave({
      ...c,
      package_name: c.package_name || 'Home Coming',
      included_programs: mergeHomeComingIncludedPrograms(c.included_programs),
    });
  };

  const unitLabel = (u) => (u === 'months' ? 'mo' : 'sessions');

  return (
    <div
      className={`border rounded-xl shadow-sm overflow-hidden ${locked ? 'ring-2 ring-amber-300' : ''}`}
      data-testid={`package-${c.package_id}`}
    >
      <div
        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b ${
          locked ? 'bg-amber-50' : 'bg-gradient-to-r from-purple-50 to-amber-50'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-mono bg-[#5D3FD3] text-white px-2 py-0.5 rounded shrink-0">
            {c.package_id}
          </span>
          <span className="text-sm font-semibold text-gray-800">Home Coming</span>
          {c.version > 1 && <span className="text-[8px] bg-gray-200 px-1.5 py-0.5 rounded">v{c.version}</span>}
          {locked && (
            <span className="text-[8px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold">
              LOCKED
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleLock}
            className={`h-7 text-[10px] px-2 ${locked ? 'border-amber-300 text-amber-700' : ''}`}
            data-testid={`lock-pkg-${c.package_id}`}
          >
            {locked ? 'Unlock' : 'Lock'}
          </Button>
          {onNewVersion && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNewVersion(c.package_id)}
              className="h-7 text-[10px] px-2"
            >
              New Ver
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(c.package_id)}
              className="h-7 text-[10px] px-2 text-red-500 border-red-200"
            >
              <Trash2 size={10} />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#5D3FD3] hover:bg-[#4c32b3] h-7 text-[10px] px-2"
            data-testid={`save-pkg-${c.package_id}`}
          >
            <Save size={10} className="mr-1" /> Save
          </Button>
        </div>
      </div>

      {stats && (
        <div className="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-4 text-[10px]">
          <span className="text-gray-600">
            People: <strong className="text-gray-900">{stats.total_people}</strong>
          </span>
          <span className="text-green-600">
            Received: <strong>{stats.total_received.toLocaleString()}</strong>
          </span>
          <span className="text-red-600">
            Due: <strong>{stats.total_due.toLocaleString()}</strong>
          </span>
          <span className="text-blue-600">
            On EMI: <strong>{stats.emi_count}</strong>
          </span>
        </div>
      )}

      <div className="px-4 py-3 space-y-4">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-800">One catalog product</strong> — bundled annual access:{' '}
          <strong className="text-gray-800">12 mo AWRP</strong>, <strong className="text-gray-800">6 mo MMM</strong>,{' '}
          <strong className="text-gray-800">4 Turbo Release</strong>, <strong className="text-gray-800">2 Meta Downloads</strong>.{' '}
          Set <strong className="text-gray-800">catalog price</strong> below; <strong className="text-gray-800">offer dates</strong> only control when
          this price may be sold (not how long each member stays — that is subscription length).
        </p>

        <ul className="text-xs text-gray-800 space-y-1 border rounded-md bg-gray-50/80 px-3 py-2.5">
          {(c.included_programs || []).map((p, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{p.name}</span>
              <span className="text-gray-500 font-mono tabular-nums">
                {p.duration_value} {unitLabel(p.duration_unit)}
              </span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <Label className="text-[10px] text-gray-600">Catalog offer valid from</Label>
            <Input type="date" value={c.valid_from || ''} onChange={onValidFromChange} className="h-8 mt-0.5" disabled={locked} />
            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">First day this price row is available.</p>
          </div>
          <div>
            <Label className="text-[10px] text-gray-600">Catalog offer valid to</Label>
            <Input type="date" value={c.valid_to || ''} onChange={(e) => set('valid_to', e.target.value)} className="h-8 mt-0.5" disabled={locked} />
            <div className="flex flex-wrap gap-1 mt-1">
              {!locked && (c.valid_from || '').trim() && (
                <>
                  <button
                    type="button"
                    className="text-[9px] px-1.5 py-0.5 rounded border border-violet-200 text-violet-800 bg-violet-50/80 hover:bg-violet-100"
                    onClick={() => suggestCatalogOfferEndMonths(12)}
                  >
                    End +12 mo after start
                  </button>
                  <button
                    type="button"
                    className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"
                    onClick={() => suggestCatalogOfferEndMonths(24)}
                  >
                    End +24 mo after start
                  </button>
                </>
              )}
            </div>
            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">
              Last day this catalog price applies — edit freely for multi‑year catalogs.
            </p>
          </div>
          <div>
            <Label className="text-[10px] text-gray-600">Member subscription length (months)</Label>
            <NumInput value={c.duration_months} onChange={onDurationMonthsChange} className="mt-0.5" />
            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">How long annual access lasts after each person&apos;s start date.</p>
          </div>
          <div>
            <Label className="text-[10px] text-gray-600">Coaching sessions (bucket)</Label>
            <NumInput
              value={c.default_sessions_current}
              onChange={(v) => set('default_sessions_current', parseInt(v, 10) || 0)}
              className="mt-0.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs max-w-xl">
          <div>
            <Label className="text-[10px] text-gray-600">Preferred membership start day (optional)</Label>
            <NumInput
              value={c.preferred_membership_day_of_month ?? 0}
              onChange={(v) => {
                const raw = parseInt(v, 10);
                const n = Number.isFinite(raw) ? Math.min(28, Math.max(0, raw)) : 0;
                set('preferred_membership_day_of_month', n);
              }}
              className="mt-0.5"
            />
            <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">
              Use <strong className="text-gray-700">3</strong> for quick‑pick “start on the 3rd”; <strong>0</strong> = any day (default).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <Label className="text-[10px] text-gray-600">Extra discount % (optional)</Label>
            <NumInput value={c.additional_discount_pct || 0} onChange={(v) => set('additional_discount_pct', parseFloat(v) || 0)} className="mt-0.5" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-600">Late fee / day</Label>
            <NumInput value={c.late_fee_per_day || 0} onChange={(v) => set('late_fee_per_day', parseFloat(v) || 0)} className="mt-0.5" />
          </div>
          <div>
            <Label className="text-[10px] text-gray-600">Channelisation fee</Label>
            <NumInput value={c.channelization_fee || 0} onChange={(v) => set('channelization_fee', parseFloat(v) || 0)} className="mt-0.5" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={!!c.show_late_fees}
            onChange={(e) => set('show_late_fees', e.target.checked)}
            disabled={locked}
            className="rounded border-gray-300"
          />
          Show late fees to students by default
        </label>

        <div className="border-t pt-3 space-y-2">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Tax %</p>
          <p className="text-[9px] text-gray-500 leading-snug">0 = no tax on this package for that currency.</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[9px] text-gray-500">INR</Label>
              <NumInput
                value={Math.round((packageTaxDecimal(c, 'INR') * 100) * 100) / 100}
                onChange={(v) => setTaxPct('INR', v)}
                className="mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">AED</Label>
              <NumInput
                value={Math.round((packageTaxDecimal(c, 'AED') * 100) * 100) / 100}
                onChange={(v) => setTaxPct('AED', v)}
                className="mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[9px] text-gray-500">USD</Label>
              <NumInput
                value={Math.round((packageTaxDecimal(c, 'USD') * 100) * 100) / 100}
                onChange={(v) => setTaxPct('USD', v)}
                className="mt-0.5"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2 bg-[#D4AF37]/5 rounded-lg p-3 border border-[#D4AF37]/25">
          <p className="text-[10px] font-semibold text-[#8a6d1d] uppercase tracking-wide">Package offer (catalog total)</p>
          <p className="text-[10px] text-gray-600">Amount shown on subscriber add/edit when this currency is selected.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {['INR', 'USD', 'AED'].map((cur) => (
              <div key={cur}>
                <Label className="text-[9px] text-gray-600">{cur}</Label>
                <NumInput value={c.offer_total?.[cur] || 0} onChange={(v) => setOfferTotal(cur, v)} bold className="mt-0.5 text-[#8a6d1d]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
