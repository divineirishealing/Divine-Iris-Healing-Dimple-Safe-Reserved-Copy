import React from 'react';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

/**
 * Sacred Home — pinned Home Coming / annual product (separate from Dashboard Config).
 * Saves with main site settings (Save Changes on this tab).
 * Pinned program uses the same catalog program data as the public site (tiers, copy, Divine Cart).
 */
export default function DashboardHomeComingTab({ settings, onChange, programs = [] }) {
  return (
    <div className="space-y-6" data-testid="dashboard-home-coming-tab">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Sacred Home — Home Coming / Annual product</h2>
        <p className="text-[11px] text-gray-600 mt-1 leading-relaxed max-w-3xl">
          Pin one <strong className="text-gray-800">catalog program</strong> to the top of the Sacred Home upcoming strip.
          It shows the <strong className="text-gray-800">same details as your website</strong> (description, tiers, pricing, Know More).
          Logged-in members use <strong className="text-gray-800">Divine Cart</strong> with the same tier and quote rules as the public enrollment flow.
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
      </div>

      <p className="text-[10px] text-gray-500">
        Members see the card on <strong className="text-gray-700">Sacred Home</strong> → upcoming programs (anchor{' '}
        <code className="text-[9px] bg-gray-100 px-1 rounded">#sacred-home-programs</code>). Save site settings with the button below.
      </p>
    </div>
  );
}
