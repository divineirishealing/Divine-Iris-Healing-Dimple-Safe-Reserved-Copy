import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';

/**
 * Sacred Home — pinned Home Coming / annual product (separate from Dashboard Config).
 * Saves with main site settings (Save Changes on this tab).
 */
export default function DashboardHomeComingTab({ settings, onChange, programs = [] }) {
  const std = settings.dashboard_sacred_home_standard_prices || {};
  const setStd = (cur, val) => {
    const next = { ...(settings.dashboard_sacred_home_standard_prices || {}) };
    const n = val === '' ? '' : parseFloat(val);
    if (n === '' || Number.isNaN(n) || n <= 0) {
      delete next[cur];
    } else {
      next[cur] = n;
    }
    onChange({ ...settings, dashboard_sacred_home_standard_prices: next });
  };

  return (
    <div className="space-y-6" data-testid="dashboard-home-coming-tab">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Sacred Home — Home Coming / Annual product</h2>
        <p className="text-[11px] text-gray-600 mt-1 leading-relaxed max-w-3xl">
          Pin one <strong className="text-gray-800">catalog program</strong> to the top of the Sacred Home upcoming strip.
          <strong className="text-gray-800"> Annual members</strong> get full pricing and Divine Cart.{' '}
          <strong className="text-gray-800">Non-annual</strong> members (still on Sacred Home) see your{' '}
          <strong className="text-gray-800">standard prices</strong> and a <strong className="text-gray-800">Contact for initiation</strong> button instead of checkout.
        </p>
      </div>

      <div className="rounded-lg border border-teal-200/80 bg-teal-50/35 p-4 space-y-4">
        <div>
          <Label className="text-xs text-gray-800">Program to pin</Label>
          <select
            className="mt-1 w-full max-w-lg border rounded-md px-2 py-2 text-sm bg-white"
            data-testid="dashboard-sacred-home-annual-program-select"
            value={settings.dashboard_sacred_home_annual_program_id || ''}
            onChange={(e) =>
              onChange({
                ...settings,
                dashboard_sacred_home_annual_program_id: e.target.value || '',
              })
            }
          >
            <option value="">— None —</option>
            {[...(programs || [])]
              .filter((p) => p && p.id)
              .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.id}
                  {p.is_upcoming ? ' · Upcoming' : ''}
                </option>
              ))}
          </select>
          <p className="text-[10px] text-gray-600 mt-1">
            Create or edit the program under <strong>Programs</strong> (tiers, images, copy). This row only chooses which one appears first on Sacred Home.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['inr', 'usd', 'aed'].map((cur) => (
            <div key={cur}>
              <Label className="text-[10px] uppercase text-gray-600">{cur} — standard list (optional)</Label>
              <Input
                type="text"
                inputMode="decimal"
                className="mt-1 text-sm"
                placeholder="e.g. 500000"
                value={std[cur] != null && std[cur] !== '' ? String(std[cur]) : ''}
                onChange={(e) => setStd(cur, e.target.value)}
                data-testid={`dashboard-home-coming-std-${cur}`}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600">
          Shown to <strong>non-annual</strong> viewers for the pinned card (detected hub currency). Leave blank to fall back to the program&apos;s tier prices when available.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-md border border-white/80 bg-white/60 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-gray-900">Show pinned program to non-annual members</p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              If off, only <strong>Annual</strong> dashboard clients see the pin; everyone else only sees the normal upcoming list.
            </p>
          </div>
          <Switch
            checked={settings.dashboard_sacred_home_show_non_annual !== false}
            onCheckedChange={(v) => onChange({ ...settings, dashboard_sacred_home_show_non_annual: !!v })}
            data-testid="dashboard-home-coming-show-non-annual"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-800">Non-annual — button label</Label>
            <Input
              className="mt-1 text-sm"
              value={settings.dashboard_sacred_home_non_annual_cta_label || 'Contact For Initiation'}
              onChange={(e) =>
                onChange({
                  ...settings,
                  dashboard_sacred_home_non_annual_cta_label: e.target.value,
                })
              }
              data-testid="dashboard-home-coming-cta-label"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-800">Non-annual — link (path or URL)</Label>
            <Input
              className="mt-1 text-sm font-mono text-[11px]"
              placeholder="/contact or https://…"
              value={settings.dashboard_sacred_home_non_annual_cta_href || ''}
              onChange={(e) =>
                onChange({
                  ...settings,
                  dashboard_sacred_home_non_annual_cta_href: e.target.value,
                })
              }
              data-testid="dashboard-home-coming-cta-href"
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-500">
        Members see the card on <strong className="text-gray-700">Sacred Home</strong> → upcoming programs (anchor <code className="text-[9px] bg-gray-100 px-1 rounded">#sacred-home-programs</code>).
        Save site settings with the button below.
      </p>
    </div>
  );
}
