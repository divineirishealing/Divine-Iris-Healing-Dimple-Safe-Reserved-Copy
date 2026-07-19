import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Save, Eye, EyeOff, FileText } from 'lucide-react';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { useToast } from '../../../hooks/use-toast';
import ImageUploader from '../ImageUploader';

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

const BlogPostsTab = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost());

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

  if (editing) {
    return (
      <div className="space-y-6" data-testid="blog-posts-form">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{editing === 'new' ? 'New Blog Post' : 'Edit Blog Post'}</h3>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
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
          <label className="text-xs font-semibold text-gray-500">Excerpt</label>
          <Textarea value={form.excerpt} onChange={(e) => setField('excerpt', e.target.value)} rows={2} placeholder="Short summary shown on the blog list" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Body</label>
          <Textarea value={form.body} onChange={(e) => setField('body', e.target.value)} rows={14} placeholder="Article content. Use **bold** and *italic* for basic formatting." />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Hero Image</label>
          <ImageUploader value={form.hero_image} onChange={(v) => setField('hero_image', v)} />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.visible} onCheckedChange={(v) => setField('visible', v)} /> Visible
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.featured} onCheckedChange={(v) => setField('featured', v)} /> Featured
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
          <p className="text-sm text-gray-500">Create and manage articles on the public /blog page</p>
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
