import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, FileText, Upload, ExternalLink } from 'lucide-react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';
import ImageUploader from '../ImageUploader';
import { isUploadApiReachable } from '../../../lib/config';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const emptyPost = () => ({
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  hero_image: '',
  author: '',
  published_at: new Date().toISOString().slice(0, 10),
  visible: true,
  featured: false,
});

function importErrorMessage(error) {
  if (!isUploadApiReachable()) {
    return 'API not configured. Set REACT_APP_BACKEND_URL and redeploy the frontend.';
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error?.response?.status === 404) {
    return 'Import endpoint not found — redeploy the backend.';
  }
  return error?.message || 'Could not read the document';
}

const BlogPostsTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost());
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const fetchAll = useCallback(async () => {
    const r = await axios.get(`${API}/blog-posts`);
    setItems(r.data || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const startNew = () => {
    setEditing('new');
    setForm(emptyPost());
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({ ...emptyPost(), ...item });
  };

  const handleDocxFile = async (file) => {
    if (!file) return;
    const lower = (file.name || '').toLowerCase();
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      toast({
        title: 'Use .docx format',
        description: 'In Word: File → Save As → Word Document (.docx).',
        variant: 'destructive',
      });
      return;
    }
    if (!lower.endsWith('.docx')) {
      toast({ title: 'Please choose a .docx file', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const url =
        editing === 'new'
          ? `${API}/blog-posts/import-docx`
          : `${API}/blog-posts/${editing}/import-docx`;
      const r = await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({
        ...prev,
        body: r.data.body || prev.body,
        import_filename: r.data.filename || r.data.import_filename || file.name,
      }));
      toast({
        title: 'Full article imported',
        description: `${file.name} — save the post when you are ready to publish.`,
      });
    } catch (e) {
      toast({ title: 'Import failed', description: importErrorMessage(e), variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    try {
      if (editing === 'new') {
        await axios.post(`${API}/blog-posts`, form);
        toast({ title: 'Blog post created' });
      } else {
        await axios.put(`${API}/blog-posts/${editing}`, form);
        toast({ title: 'Blog post updated' });
      }
      setEditing(null);
      fetchAll();
    } catch (e) {
      toast({ title: 'Save failed', description: e.response?.data?.detail || e.message, variant: 'destructive' });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this blog post?')) return;
    await axios.delete(`${API}/blog-posts/${id}`);
    toast({ title: 'Deleted' });
    if (editing === id) setEditing(null);
    fetchAll();
  };

  const toggleVis = async (item) => {
    await axios.patch(`${API}/blog-posts/${item.id}/visibility`, { visible: !item.visible });
    fetchAll();
  };

  const previewSlug = (form.slug || '').trim();
  const previewHref = previewSlug ? `/blog/${previewSlug}` : null;

  if (editing) {
    return (
      <div className="space-y-8" data-testid="blog-posts-form">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-bold text-gray-800">{editing === 'new' ? 'New Blog Post' : 'Edit Blog Post'}</h3>
          <div className="flex items-center gap-2">
            {previewHref && (
              <a
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-700 hover:underline"
              >
                Preview <ExternalLink size={12} />
              </a>
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>

        {/* Cover — shown on /blog list */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-5 space-y-4">
          <div>
            <h4 className="font-bold text-purple-900 text-sm">Cover (blog list card)</h4>
            <p className="text-xs text-purple-700/80 mt-1">
              This is what visitors see on /blog — cover image, title, and teaser. They click &quot;Read the full piece&quot; to open the article.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500">Title</label>
              <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Slug</label>
              <Input value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder="auto-generated if empty" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Author</label>
              <Input value={form.author} onChange={(e) => setField('author', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Published date</label>
              <Input type="date" value={form.published_at || ''} onChange={(e) => setField('published_at', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Teaser / excerpt (shown on cover card)</label>
            <Textarea
              value={form.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
              rows={3}
              placeholder="Short summary — visitors read this on the blog list before clicking through"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Cover image (upload)</label>
            <p className="text-[10px] text-gray-500 mb-2">Shown on the blog list card and at the top of the full article.</p>
            <ImageUploader value={form.hero_image} onChange={(v) => setField('hero_image', v)} label="Cover image" />
          </div>
        </div>

        {/* Full article */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 space-y-4">
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Full article (after click-through)</h4>
            <p className="text-xs text-blue-700/80 mt-1">
              Upload a Word <strong>.docx</strong> for the complete piece, or type/edit the body below.
            </p>
          </div>

          <div
            className={`rounded-lg p-4 border-2 border-dashed transition-colors ${
              dragOver ? 'bg-blue-100 border-blue-400' : 'bg-white border-blue-200'
            } ${importing ? 'opacity-60 pointer-events-none' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleDocxFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="flex items-start gap-3">
              <Upload size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">Upload full article (.docx)</p>
                <p className="text-[10px] text-blue-600 mt-1 leading-relaxed">
                  Drag a Word document here or choose a file. Headings, bold, and lists are preserved on the public article page.
                </p>
                {form.import_filename && (
                  <p className="text-[10px] text-emerald-700 mt-2">
                    Last import: <strong>{form.import_filename}</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleDocxFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {importing ? 'Reading document…' : 'Choose .docx file'}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Article body (manual edit)</label>
            <Textarea
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
              rows={12}
              placeholder="Full article text, or upload a .docx above. Use **bold** and *italic* for plain-text articles."
            />
            {form.body?.length > 0 && (
              <p className="text-[10px] text-gray-500 mt-1">{form.body.length.toLocaleString()} characters</p>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.visible} onCheckedChange={(v) => setField('visible', v)} /> Visible on /blog
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.featured} onCheckedChange={(v) => setField('featured', v)} /> Featured on cover card
          </label>
        </div>

        <Button onClick={save} className="w-full"><Save size={16} className="mr-2" /> Save Blog Post</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="blog-posts-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> Blog Posts</h3>
          <p className="text-sm text-gray-500">Cover card on /blog → click through to the full uploaded article</p>
        </div>
        <Button onClick={startNew}><Plus size={14} className="mr-1" /> Add Blog Post</Button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No blog posts yet. Click &quot;Add Blog Post&quot; to publish your first article.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-4 border rounded-lg bg-white">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {item.author || 'No author'} · /blog/{item.slug}
                  {item.published_at ? ` · ${item.published_at}` : ''}
                  {item.body ? ` · ${item.body.length.toLocaleString()} chars` : ' · no body yet'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleVis(item)}
                className="p-2 rounded hover:bg-gray-100"
                title={item.visible ? 'Hide' : 'Show'}
              >
                {item.visible ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
              </button>
              <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => remove(item.id)}><Trash2 size={14} /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogPostsTab;
