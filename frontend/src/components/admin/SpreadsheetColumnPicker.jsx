import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';

/**
 * Persisted show/hide for admin spreadsheet-style tables.
 * @param {string} storageKey - unique per table (e.g. admin-clients-columns-v1)
 * @param {{ id: string, label: string, required?: boolean }[]} columns
 */
export function useSpreadsheetColumnVisibility(storageKey, columns) {
  const defaults = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, true])),
    [columns],
  );

  const mergeAndValidate = useCallback(
    (raw) => {
      const merged = { ...defaults, ...raw };
      const hideable = columns.filter((c) => !c.required);
      if (hideable.length === 0) return merged;
      const anyHideableVisible = hideable.some((c) => merged[c.id] !== false);
      if (!anyHideableVisible) return { ...defaults };
      return merged;
    },
    [columns, defaults],
  );

  const [visibility, setVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...defaults };
      return mergeAndValidate(JSON.parse(raw));
    } catch {
      return { ...defaults };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibility));
    } catch (_) {
      /* ignore */
    }
  }, [storageKey, visibility]);

  const setColumn = (id, checked) => {
    const col = columns.find((c) => c.id === id);
    if (col?.required) return;
    setVisibility((prev) => mergeAndValidate({ ...prev, [id]: checked }));
  };

  const reset = () => setVisibility({ ...defaults });

  const isVisible = (id) => visibility[id] !== false;

  const visibleCount = columns.filter((c) => isVisible(c.id)).length;

  return { visibility, setColumn, reset, isVisible, visibleCount };
}

export function SpreadsheetColumnPicker({ columns, visibility, onToggle, onReset, className }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={`h-8 text-[10px] gap-1 ${className || ''}`}>
          <Columns3 size={14} /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Show columns</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {columns.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <Checkbox
                checked={visibility[c.id] !== false}
                disabled={!!c.required}
                onCheckedChange={(v) => onToggle(c.id, v === true)}
              />
              <span className={c.required ? 'text-gray-400' : ''}>
                {c.label}
                {c.required ? ' · fixed' : ''}
              </span>
            </label>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="w-full mt-2 text-[10px] h-7" onClick={onReset}>
          Reset to default
        </Button>
      </PopoverContent>
    </Popover>
  );
}
