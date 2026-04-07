import React from 'react';
import axios from 'axios';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';

const API = process.env.REACT_APP_BACKEND_URL;

/** Per-slot online / offline — single toggle (calls choose-mode). Light UI for cards/tables. */
export function SessionModeToggle({ programName, sessionIndex, modeChoice, programDefaultMode, onSuccess }) {
  const { toast } = useToast();
  const effective = ((modeChoice || programDefaultMode || 'online') + '').toLowerCase();
  const isOffline = effective === 'offline';

  const flip = () => {
    const next = isOffline ? 'online' : 'offline';
    axios
      .post(
        `${API}/api/student/choose-mode`,
        { program_name: programName, session_index: sessionIndex, mode: next },
        { withCredentials: true }
      )
      .then(() => {
        onSuccess();
        toast({ title: next === 'online' ? 'Set to online' : 'Set to offline' });
      })
      .catch(() => toast({ title: 'Could not update mode', variant: 'destructive' }));
  };

  return (
    <div className="flex items-center gap-2 shrink-0 ml-auto">
      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide w-14 text-right">
        {isOffline ? 'Offline' : 'Online'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOffline}
        aria-label={isOffline ? 'Switch to online' : 'Switch to offline'}
        onClick={(e) => {
          e.stopPropagation();
          flip();
        }}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5D3FD3] focus-visible:ring-offset-1',
          isOffline ? 'bg-emerald-600' : 'bg-[#5D3FD3]'
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            isOffline ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}
