import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Check, X, User, Clock, History } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

const ProfileApprovals = () => {
  const [pending, setPending] = useState([]);
  const [activity, setActivity] = useState([]);
  const { toast } = useToast();

  const loadAll = useCallback(() => {
    Promise.all([
      axios.get(`${API}/api/admin/clients/approvals`).then((r) => r.data).catch(() => []),
      axios.get(`${API}/api/admin/clients/profile-activity`).then((r) => r.data).catch(() => []),
    ]).then(([appr, act]) => {
      setPending(Array.isArray(appr) ? appr : []);
      setActivity(Array.isArray(act) ? act : []);
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAction = async (id, action) => {
    try {
      await axios.post(`${API}/api/admin/clients/${action}/${id}`);
      toast({ title: `Profile ${action}d` });
      loadAll();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <History size={20} className="text-amber-600" />
          Profile activity & saves
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Recent client profile saves include timestamps and field-level changes. Older “pending approval” items may still appear below if they were never cleared.
        </p>
      </div>

      {activity.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center text-sm text-gray-400">
          No timestamped profile saves yet. Saves appear here after clients use “Save profile” on the dashboard.
        </div>
      )}

      {activity.length > 0 && (
        <div className="space-y-3">
          {activity.map((ev, i) => (
            <div
              key={`${ev.user_id}-${ev.at}-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-start"
            >
              <div className="flex shrink-0 items-center gap-2 text-gray-500">
                <Clock size={16} />
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{formatWhen(ev.at)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">
                  {ev.name || '—'}{' '}
                  <span className="text-xs font-normal text-gray-500">({ev.email || ev.user_id})</span>
                </h3>
                <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                  {Object.entries(ev.changes || {}).map(([key, diff]) => (
                    <div key={key} className="rounded border border-violet-100 bg-violet-50/50 px-2 py-1.5">
                      <span className="font-medium capitalize text-violet-900">{key.replace(/_/g, ' ')}</span>
                      <div className="text-gray-600">
                        <span className="line-through opacity-70">{String(diff?.from ?? '—')}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="font-medium">{String(diff?.to ?? '—')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-8">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Legacy pending approvals</h2>
        <p className="mb-4 text-xs text-gray-500">
          Profiles submitted under the old approval flow. Approve or reject to clear the queue, or ignore if you only use direct saves.
        </p>

        {pending.length === 0 && (
          <div className="rounded-lg border bg-gray-50 py-6 text-center text-sm text-gray-400">No pending approvals.</div>
        )}

        {pending.map((req) => (
          <div key={req.id} className="mb-4 flex flex-col items-stretch gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <User size={20} className="text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900">
                {req.name} <span className="text-xs font-normal text-gray-500">({req.email})</span>
              </h3>
              <div className="mt-2 grid grid-cols-1 gap-2 rounded border border-amber-100 bg-amber-50 p-3 text-sm sm:grid-cols-2">
                {Object.entries(req.pending_profile_update || {}).map(([key, val]) => (
                  <div key={key}>
                    <span className="font-medium capitalize text-amber-800">{key.replace(/_/g, ' ')}:</span>
                    <span className="ml-2 text-gray-700">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-row gap-2 sm:flex-col">
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(req.id, 'approve')}>
                <Check size={14} className="mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleAction(req.id, 'reject')}>
                <X size={14} className="mr-1" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileApprovals;
