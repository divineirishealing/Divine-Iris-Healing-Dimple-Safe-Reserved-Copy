import React, { useMemo } from 'react';
import { buildIndiaGpayOptions, buildIndiaBankOptions } from '../../lib/indiaPaymentTags';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import IndiaDiscountBandsEditor from './IndiaDiscountBandsEditor';

/**
 * Shared block: preferred / tagged India rails, discounts, tax, CRM late & channelization fees.
 * Used by Dashboard access and Client finances tabs (single source of truth for UI).
 */
export default function ClientFinanceFields({
  indiaSite,
  preferredPaymentMethod,
  onPreferredPaymentChange,
  indiaPaymentMethod,
  onIndiaPaymentMethodChange,
  preferredIndiaGpayId,
  onPreferredIndiaGpayIdChange,
  preferredIndiaBankId,
  onPreferredIndiaBankIdChange,
  indiaDiscountPercent,
  onIndiaDiscountPercentChange,
  indiaDiscountBandRows,
  onIndiaDiscountBandRowsChange,
  indiaTaxEnabled,
  onIndiaTaxEnabledChange,
  indiaTaxPercent,
  onIndiaTaxPercentChange,
  indiaTaxLabel,
  onIndiaTaxLabelChange,
  crmLateFeePerDay,
  onCrmLateFeePerDayChange,
  crmChannelizationFee,
  onCrmChannelizationFeeChange,
  crmShowLateFees,
  onCrmShowLateFeesChange,
  testIdPrefix = 'client-finance',
}) {
  const indiaGpayOpts = useMemo(() => buildIndiaGpayOptions(indiaSite || {}), [indiaSite]);
  const indiaBankOpts = useMemo(() => buildIndiaBankOptions(indiaSite || {}), [indiaSite]);

  const showTaggedGpayPicker = useMemo(() => {
    const pref = (preferredPaymentMethod || '').trim().toLowerCase();
    const tag = (indiaPaymentMethod || '').trim().toLowerCase();
    return (
      pref === 'gpay_upi' ||
      tag === 'gpay_upi' ||
      tag === 'gpay' ||
      tag === 'upi' ||
      tag === 'any'
    );
  }, [preferredPaymentMethod, indiaPaymentMethod]);

  const showTaggedBankPicker = useMemo(() => {
    const pref = (preferredPaymentMethod || '').trim().toLowerCase();
    const tag = (indiaPaymentMethod || '').trim().toLowerCase();
    return (
      pref === 'bank_transfer' ||
      pref === 'cash_deposit' ||
      tag === 'bank_transfer' ||
      tag === 'cash_deposit' ||
      tag === 'cash' ||
      tag === 'any'
    );
  }, [preferredPaymentMethod, indiaPaymentMethod]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-gray-600">Preferred payment method</Label>
        <p className="text-[10px] text-gray-400 mb-1">
          Choose Bank or GPay/UPI to load Divine Iris accounts from Site Settings → Indian Payment.
        </p>
        <select
          value={preferredPaymentMethod}
          onChange={(e) => onPreferredPaymentChange(e.target.value)}
          className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
          data-testid={`${testIdPrefix}-preferred-payment`}
        >
          <option value="">— Not set —</option>
          <option value="gpay_upi">GPay / UPI</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cash_deposit">Cash deposit</option>
          <option value="stripe">Stripe</option>
        </select>
      </div>

      <div>
        <Label className="text-xs text-gray-600">Payment method tag</Label>
        <p className="text-[10px] text-gray-400 mb-1.5">
          Which rails show on checkout. Then pin a Divine Iris GPay or bank row from Site Settings → Indian Payment.
        </p>
        <select
          value={indiaPaymentMethod}
          onChange={(e) => onIndiaPaymentMethodChange(e.target.value)}
          className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
        >
          <option value="">— Not tagged —</option>
          <option value="gpay_upi">GPay / UPI</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cash_deposit">Cash deposit</option>
          <option value="stripe">Stripe</option>
          <option value="any">Any / multiple</option>
        </select>
      </div>

      {showTaggedGpayPicker &&
        (indiaGpayOpts.length >= 1 ? (
          <div>
            <Label className="text-xs text-gray-600">Tagged UPI (Divine Iris — Indian Payment)</Label>
            <p className="text-[10px] text-gray-400 mb-1">
              Rows from site settings (e.g. Priyanka&apos;s GPay). Leave blank to allow every UPI on checkout.
            </p>
            <select
              value={preferredIndiaGpayId}
              onChange={(e) => onPreferredIndiaGpayIdChange(e.target.value)}
              className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              data-testid={`${testIdPrefix}-preferred-gpay`}
            >
              <option value="">All UPIs (full list on payment)</option>
              {indiaGpayOpts.map((o) => (
                <option key={o.tag_id} value={o.tag_id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
            Add GPay / UPI rows under <strong>Admin → Indian Payment</strong> to tag a specific account here.
          </div>
        ))}

      {showTaggedBankPicker &&
        (indiaBankOpts.length >= 1 ? (
          <div>
            <Label className="text-xs text-gray-600">Tagged bank account (Divine Iris — Indian Payment)</Label>
            <p className="text-[10px] text-gray-400 mb-1">
              Bank details loaded from site settings. Pick which account this client should use.
            </p>
            <select
              value={preferredIndiaBankId}
              onChange={(e) => onPreferredIndiaBankIdChange(e.target.value)}
              className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-1"
              data-testid={`${testIdPrefix}-preferred-bank`}
            >
              <option value="">All accounts (student picks)</option>
              {indiaBankOpts.map((o) => (
                <option key={o.tag_id} value={o.tag_id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
            Add bank accounts under <strong>Admin → Indian Payment</strong> so bank details can be tagged here.
          </div>
        ))}

      <div>
        <Label className="text-xs text-gray-600">Discount % on base price</Label>
        <p className="text-[10px] text-gray-400 mb-1">
          Applied before GST. Leave empty for no client-specific flat discount (site default applies unless bands match
          below).
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={indiaDiscountPercent}
            onChange={(e) => onIndiaDiscountPercentChange(e.target.value)}
            placeholder="e.g. 9"
            className="text-sm"
          />
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-600">Optional: group discount by number of people</Label>
        <p className="text-[10px] text-gray-400 mb-2">
          Total participants on Sacred Exchange checkout. First matching rule wins. Choose either a percent or a fixed ₹
          amount per row. Checkout label: Group discount.
        </p>
        <IndiaDiscountBandsEditor rows={indiaDiscountBandRows} onChange={onIndiaDiscountBandRowsChange} />
      </div>

      <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={indiaTaxEnabled}
            onChange={(e) => onIndiaTaxEnabledChange(e.target.checked)}
            className="rounded border-orange-300"
          />
          <span className="text-sm font-medium text-gray-800">GST / tax applicable on after-discount price</span>
        </label>
        {indiaTaxEnabled && (
          <div className="grid grid-cols-2 gap-2 pl-1">
            <div>
              <Label className="text-[10px] text-gray-500">Rate % (0 = no tax)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={indiaTaxPercent}
                onChange={(e) => onIndiaTaxPercentChange(e.target.value)}
                className="h-9 text-sm mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Label (e.g. GST)</Label>
              <Input
                value={indiaTaxLabel}
                onChange={(e) => onIndiaTaxLabelChange(e.target.value)}
                className="h-9 text-sm mt-0.5"
                placeholder="GST"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3 space-y-3">
        <p className="text-xs font-semibold text-gray-800">Late fee &amp; channelization (CRM)</p>
        <p className="text-[10px] text-gray-500">
          Optional defaults for Sacred Home. Leave blank to use site-wide portal defaults. If this client has a priced
          subscriber row in Excel, filled cells there still override these (and empty Excel cells fall back to CRM, then
          site).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-gray-500">Late fee / day</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={crmLateFeePerDay}
              onChange={(e) => onCrmLateFeePerDayChange(e.target.value)}
              placeholder="Site default"
              className="h-9 text-sm mt-0.5"
            />
          </div>
          <div>
            <Label className="text-[10px] text-gray-500">Channelization fee</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={crmChannelizationFee}
              onChange={(e) => onCrmChannelizationFeeChange(e.target.value)}
              placeholder="Site default"
              className="h-9 text-sm mt-0.5"
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-gray-500">Show late-fee line</Label>
          <select
            value={crmShowLateFees}
            onChange={(e) => onCrmShowLateFeesChange(e.target.value)}
            className="w-full text-sm border rounded-md px-2 py-2 bg-white mt-0.5"
          >
            <option value="">Site default</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}
