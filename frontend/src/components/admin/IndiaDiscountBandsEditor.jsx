import React from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { newBandRow } from '../../lib/indiaDiscountBandsUi';

/**
 * @param {object[]} rows
 * @param {(rows: object[]) => void} onChange
 * @param {boolean} [compact] - tighter spacing for Client Garden inline card
 */
export default function IndiaDiscountBandsEditor({ rows, onChange, compact }) {
  const setRow = (idx, patch) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, newBandRow()]);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {rows.length === 0 ? (
        <p className="text-[10px] text-gray-400">
          No group rules yet. Add a row to set a different discount for a range of participant counts (Sacred Exchange
          checkout).
        </p>
      ) : null}
      {rows.map((row, idx) => (
        <div
          key={row.id}
          className={`flex flex-wrap items-end gap-2 rounded-md border border-gray-200 bg-white/90 ${
            compact ? 'p-1.5' : 'p-2'
          }`}
        >
          <div className="w-[4.25rem]">
            <Label className="text-[10px] text-gray-500">Min</Label>
            <Input
              type="number"
              min={0}
              className={compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}
              value={row.min}
              onChange={(e) => setRow(idx, { min: e.target.value })}
            />
          </div>
          <div className="w-[4.25rem]">
            <Label className="text-[10px] text-gray-500">Max</Label>
            <Input
              type="number"
              min={0}
              className={compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}
              value={row.max}
              onChange={(e) => setRow(idx, { max: e.target.value })}
            />
          </div>
          <div className="w-[7.5rem]">
            <Label className="text-[10px] text-gray-500">Discount</Label>
            <select
              className={`w-full border rounded-md px-1 bg-white ${compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}`}
              value={row.kind}
              onChange={(e) => setRow(idx, { kind: e.target.value, value: '' })}
            >
              <option value="percent">Percent %</option>
              <option value="amount">Fixed ₹</option>
            </select>
          </div>
          <div className="flex-1 min-w-[5rem]">
            <Label className="text-[10px] text-gray-500">{row.kind === 'amount' ? 'Amount (₹)' : 'Percent'}</Label>
            <Input
              type="number"
              min={0}
              step={row.kind === 'amount' ? 1 : 0.5}
              max={row.kind === 'percent' ? 100 : undefined}
              className={compact ? 'h-7 text-[10px]' : 'h-8 text-xs'}
              value={row.value}
              onChange={(e) => setRow(idx, { value: e.target.value })}
            />
          </div>
          <div className="pb-0.5">
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
              onClick={() => remove(idx)}
              aria-label="Remove rule"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className={compact ? 'text-[10px] h-7' : 'text-xs h-8'} onClick={add}>
        <Plus size={14} className="mr-1" /> Add rule
      </Button>
    </div>
  );
}
