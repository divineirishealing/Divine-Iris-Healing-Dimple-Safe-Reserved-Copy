import React from 'react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

/** Duration label + optional session-day override (card badge uses session days instead of start→end span). */
export default function DurationScheduleEditor({ row, onUpdate, compact = false }) {
  return (
    <div
      className={compact ? 'space-y-1 min-w-[100px]' : 'space-y-1.5 min-w-[120px]'}
      data-testid="duration-schedule-editor"
    >
      <Input
        value={row?.duration || ''}
        onChange={(e) => onUpdate('duration', e.target.value)}
        placeholder="7 Days"
        className={compact ? 'h-7 text-[10px] px-1' : 'h-8 text-xs px-2'}
        data-testid="duration-text-input"
        title="Optional custom label; session days below override the card badge when set"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <Input
          type="number"
          min={0}
          max={90}
          value={row?.session_days || ''}
          onChange={(e) => onUpdate('session_days', parseInt(e.target.value, 10) || 0)}
          placeholder="7"
          title="Live session days on the card (e.g. 7 for Jul 31 + Aug 1–2, 8–9, 15–16). Overrides calendar span."
          className={`${compact ? 'h-6 w-12 text-[9px]' : 'h-7 w-14 text-[10px]'} px-1`}
          data-testid="session-days-input"
        />
        <span
          className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-gray-600 font-medium whitespace-nowrap`}
          title="Total live session days shown on the card instead of start–end calendar days"
        >
          sessions
        </span>
        <Switch
          checked={!!row?.weekends_only}
          onCheckedChange={(v) => onUpdate('weekends_only', v)}
          data-testid="weekends-only-toggle"
        />
        <span
          className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-gray-600 font-medium whitespace-nowrap`}
          title="Append (Wknds) on the card when sessions are Sat/Sun only"
        >
          Wknd tag
        </span>
      </div>
    </div>
  );
}
