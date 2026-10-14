import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

import { getApiUrl } from '../lib/config';

function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  return 'Could not submit your comment. Please try again.';
}

export default function BlogCommentsSection({ postSlug, enabled }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ author_name: '', author_email: '', body: '' });

  const load = useCallback(async () => {
    if (!enabled || !postSlug) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await axios.get(`${getApiUrl()}/blog-comments/by-slug/${encodeURIComponent(postSlug)}`);
      setComments(Array.isArray(r.data) ? r.data : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, postSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await axios.post(`${getApiUrl()}/blog-comments`, {
        post_slug: postSlug,
        author_name: form.author_name.trim(),
        author_email: form.author_email.trim(),
        body: form.body.trim(),
      });
      setSent(true);
      setError('');
      setForm({ author_name: '', author_email: '', body: '' });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-[#faf8fc] border-t border-[#ebe6f2] py-12" data-testid="blog-comments-section">
      <div className="docx-page mx-auto w-full max-w-[720px] px-6 md:px-10">
        <h2 className="text-lg font-semibold text-[#534AB7] flex items-center gap-2 mb-6">
          <MessageCircle size={20} />
          Comments
        </h2>

        {loading ? (
          <div className="flex justify-center py-8 text-[#7c6fa8]">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500 mb-8">Be the first to share your thoughts — comments appear after review.</p>
        ) : (
          <ul className="space-y-5 mb-10">
            {comments.map((c) => (
              <li key={c.id} className="bg-white rounded-lg border border-[#ebe6f2] px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{c.author_name}</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap leading-relaxed">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-6 space-y-2">
            <p className="font-semibold">Thank you — we received your comment.</p>
            <p className="text-sm text-emerald-800/90">
              It will appear on this article after the Divine Iris team reviews it. You do not need to submit again.
            </p>
            <button
              type="button"
              className="text-sm text-[#534AB7] font-medium underline mt-2"
              onClick={() => setSent(false)}
            >
              Write another comment
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-xl border border-[#ebe6f2] p-5 shadow-sm">
            <p className="text-xs text-gray-500">All comments are moderated before they are published.</p>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <Input
                  value={form.author_name}
                  onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                  required
                  maxLength={120}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Email (optional)</label>
                <Input
                  type="email"
                  value={form.author_email}
                  onChange={(e) => setForm((f) => ({ ...f, author_email: e.target.value }))}
                  maxLength={254}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Comment *</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
                rows={4}
                maxLength={4000}
                className="mt-1"
                placeholder="Share what resonated with you…"
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-[#534AB7] hover:bg-[#4338a8]">
              {submitting ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Send size={16} className="mr-2" />
              )}
              Submit comment
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
