import React from 'react';
import { Button } from '../../ui/button';

/**
 * Lightweight hub only — no data, no package editor. Real work lives in linked tabs.
 */
export default function AnnualPackageCatalogTemplate({ onOpenAdminTab }) {
  const go = (key) => {
    if (onOpenAdminTab) onOpenAdminTab(key);
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4" data-testid="annual-package-catalog-template">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Annual membership — simple template</h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Use this page as a checklist. All editing happens in the tabs below — nothing to configure here.
          </p>
        </div>

        <ol className="list-decimal list-inside text-sm text-gray-800 space-y-3">
          <li>
            <span className="font-medium text-gray-900">Package catalog &amp; client subscriptions</span>
            <span className="text-gray-600"> — PKG rows, EMI, manual add, Excel to clients.</span>
            <div className="mt-2 pl-5">
              <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => go('subscribers_crm')}>
                Open Subscriptions &amp; packages
              </Button>
            </div>
          </li>
          <li>
            <span className="font-medium text-gray-900">Sacred Home prices</span>
            <span className="text-gray-600"> — INR / USD / AED for the pinned card.</span>
            <div className="mt-2 pl-5">
              <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => go('dashboard_home_coming')}>
                Open Home Coming (Sacred Home)
              </Button>
            </div>
          </li>
          <li>
            <span className="font-medium text-gray-900">People &amp; portal</span>
            <span className="text-gray-600"> — annual program spreadsheet (separate list).</span>
            <div className="mt-2 pl-5">
              <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => go('annual_portal_clients')}>
                Open Annual + dashboard
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-xs ml-2" onClick={() => go('annual_subscribers')}>
                Annual Subscribers sheet
              </Button>
            </div>
          </li>
        </ol>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-2">One-line map</p>
          <div className="text-xs font-mono text-gray-700 bg-gray-50 rounded-md p-3 space-y-1.5 border border-gray-100">
            <div>Pricing row (PKG-…) → Subscriptions &amp; packages → Pkg Config</div>
            <div>Home Coming card → Dashboard → Home Coming</div>
            <div>Portal clients → Annual + dashboard · Extra annual sheet → Annual Subscribers</div>
          </div>
        </div>
      </div>
    </div>
  );
}
