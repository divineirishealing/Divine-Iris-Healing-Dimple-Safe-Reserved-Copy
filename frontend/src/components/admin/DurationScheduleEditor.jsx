import React from 'react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

/** Duration + weekends-only workshop schedule (Sat/Sun session days). */
export default function DurationScheduleEditor({ row, onUpdate, compact = false }) {
  return (
    <div
      className={compact ? 'space-y-1 min-w-[100px]' : 'space-y-1.5 min-w-[120px]'}
      data-testid="duration-schedule-editor"
    >
      <Input
        value={row?.duration || ''}
        onChange={(e) => onUpdate('duration', e.target.value)}
        placeholder={row?.weekends_only ? '7 Days' : '21 Days'}
        className={compact ? 'h-7 text-[10px] px-1' : 'h-8 text-xs px-2'}
        data-testid="duration-text-input"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <Switch
          checked={!!row?.weekends_only}
          onCheckedChange={(v) => onUpdate('weekends_only', v)}
          data-testid="weekends-only-toggle"
        />
        <span
          className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-gray-600 font-medium whitespace-nowrap`}
          title="Workshop runs on Saturdays and Sundays only"
        >
          Wknd only
        </span>
        {row?.weekends_only && (
          <Input
            type="number"
            min={1}
            max={90}
            value={row?.session_days || ''}
            onChange={(e) => onUpdate('session_days', parseInt(e.target.value, 10) || 0)}
            placeholder="7"
            title="Total session days on weekends (e.g. 7 for a 7-day weekend workshop)"
            className={`${compact ? 'h-6 w-12 text-[9px]' : 'h-7 w-14 text-[10px]'} px-1`}
            data-testid="session-days-input"
          />
        )}
      </div>
    </div>
  );
}
