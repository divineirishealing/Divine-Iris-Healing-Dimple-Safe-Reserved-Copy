import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Check, MessageSquare, Trash2, X, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';
import { adminHeaders, isAdminSessionError } from '../../../lib/adminSession';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_FILTERS = [
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function BlogCommentsTab({ settings, onSettingsChange }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const commentsOn = settings?.blog_comments_enabled === true;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        axios.get(`${API}/blog-comments`, {
          headers: adminHeaders(),
          params: { status: filter },
        }),
        axios.get(`${API}/blog-comments/pending-count`, { headers: adminHeaders() }),
      ]);
      setRows(Array.isArray(listRes.data) ? listRes.data : []);
      setPendingCount(countRes.data?.count ?? 0);
    } catch (err) {
      if (isAdminSessionError(err)) {
        toast({ title: 'Admin session expired', variant: 'destructive' });
      } else {
        toast({ title: 'Could not load comments', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleComments = (v) => {
    onSettingsChange?.({ ...settings, blog_comments_enabled: v });
  };

  const moderate = async (id, action) => {
    try {
      await axios.patch(`${API}/blog-comments/${id}/${action}`, {}, { headers: adminHeaders() });
      toast({ title: action === 'approve' ? 'Comment approved' : 'Comment rejected' });
      load();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err.response?.data?.detail || err.message,
        variant: 'destructive',
      });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this comment permanently?')) return;
    try {
      await axios.delete(`${API}/blog-comments/${id}`, { headers: adminHeaders() });
      toast({ title: 'Comment deleted' });
      load();
    } catch (err) {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6" data-testid="blog-comments-tab">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare size={18} />
            Blog comments
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Readers can comment on published articles. New comments stay <strong>pending</strong> until you approve them.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-lg border text-gray-500 hover:text-purple-600"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-purple-50/50 border-purple-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">Allow comments on blog posts</p>
          <p className="text-xs text-gray-600 mt-0.5">Turn off to hide the form and approved comments on the public site.</p>
        </div>
        <Switch checked={commentsOn} onCheckedChange={toggleComments} />
      </div>

      {commentsOn && pendingCount > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <strong>{pendingCount}</strong> comment{pendingCount === 1 ? '' : 's'} waiting for review.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.id
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No comments in this filter.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div
              key={c.id}
              className={`p-4 rounded-lg border bg-white ${
                c.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{c.author_name}</p>
                  <p className="text-xs text-gray-500">
                    {c.post_title || c.post_slug}
                    {c.author_email ? ` · ${c.author_email}` : ''}
                    {c.created_at ? ` · ${String(c.created_at).slice(0, 10)}` : ''}
                  </p>
                  <span
                    className={`inline-block mt-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${
                      c.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'rejected'
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  {c.status === 'pending' && (
                    <>
                      <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => moderate(c.id, 'approve')}>
                        <Check size={14} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => moderate(c.id, 'reject')}>
                        <X size={14} className="mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {c.status === 'approved' && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => moderate(c.id, 'reject')}>
                      Unpublish
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => remove(c.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-800 mt-3 whitespace-pre-wrap leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
