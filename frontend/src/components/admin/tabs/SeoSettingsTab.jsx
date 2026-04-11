import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import ImageUploader from '../ImageUploader';
import { resolveImageUrl } from '../../../lib/imageUtils';
import { useToast } from '../../../hooks/use-toast';
import { Search, Copy, ExternalLink } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const SeoSettingsTab = ({ settings, onChange }) => {
  const { toast } = useToast();
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });

  const sitemapUrl = `${BACKEND_URL}/api/sitemap.xml`;

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard' });
    }).catch(() => {
      toast({ title: 'Could not copy', variant: 'destructive' });
    });
  };

  return (
    <div data-testid="seo-settings-tab" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Search className="w-5 h-5 text-[#D4AF37]" /> SEO & Google
        </h2>
        <p className="text-xs text-gray-500 max-w-2xl">
          These fields control how your site appears in Google search, Facebook shares and browser tabs.
          Fill them once, then click <strong>Save Changes</strong> below. No code required.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-xs text-amber-900 space-y-2">
        <p className="font-semibold">Quick checklist (about 15 minutes)</p>
        <ol className="list-decimal list-inside space-y-1 text-amber-800">
          <li>Set <strong>Public site URL</strong> to your real domain (https://…).</li>
          <li>Write a clear <strong>default description</strong> (~150 characters).</li>
          <li>Upload a <strong>share image</strong> (1200×630 looks great on social).</li>
          <li>In <a className="underline font-medium" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Google Search Console</a>, add your property and submit the sitemap URL below.</li>
        </ol>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">Basics</p>
        <div>
          <Label className="text-xs text-gray-500">Public site URL (canonical)</Label>
          <Input
            value={s.seo_site_url || ''}
            onChange={(e) => set('seo_site_url', e.target.value.trim())}
            placeholder="https://divineirishealing.com"
            className="mt-1"
          />
          <p className="text-[10px] text-gray-400 mt-1">No trailing slash. Used for correct links in Google and when people share your pages.</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Homepage title (browser tab &amp; Google)</Label>
          <Input
            value={s.seo_default_title || ''}
            onChange={(e) => set('seo_default_title', e.target.value)}
            placeholder="Divine Iris Healing"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Default description</Label>
          <Textarea
            value={s.seo_default_description || ''}
            onChange={(e) => set('seo_default_description', e.target.value)}
            rows={4}
            placeholder="One or two sentences: who you help, what you offer, and where you work."
            className="mt-1"
          />
          <p className="text-[10px] text-gray-400 mt-1">Aim for ~150 characters. Used on the homepage and as a fallback for other pages.</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Keywords (optional)</Label>
          <Input
            value={s.seo_keywords || ''}
            onChange={(e) => set('seo_keywords', e.target.value)}
            placeholder="energy healing, Dubai, transformation, spiritual healing"
            className="mt-1"
          />
          <p className="text-[10px] text-gray-400 mt-1">Comma-separated. Nice to have; focus on a great description first.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">Social sharing image</p>
        <p className="text-xs text-gray-500">Shown when someone shares your link on WhatsApp, Facebook or LinkedIn.</p>
        <ImageUploader
          value={s.seo_og_image_url || ''}
          onChange={(url) => set('seo_og_image_url', url)}
        />
        {s.seo_og_image_url && (
          <img src={resolveImageUrl(s.seo_og_image_url)} alt="" className="max-w-md rounded border mt-2" />
        )}
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">Twitter / X (optional)</p>
        <div>
          <Label className="text-xs text-gray-500">Username (without @)</Label>
          <Input
            value={s.seo_twitter_handle || ''}
            onChange={(e) => set('seo_twitter_handle', e.target.value.replace(/^@/, ''))}
            placeholder="yourhandle"
            className="mt-1"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">Business name for Google (structured data)</p>
        <div>
          <Label className="text-xs text-gray-500">Organization name</Label>
          <Input
            value={s.seo_organization_name || ''}
            onChange={(e) => set('seo_organization_name', e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Short organization description</Label>
          <Textarea
            value={s.seo_organization_description || ''}
            onChange={(e) => set('seo_organization_description', e.target.value)}
            rows={3}
            className="mt-1"
          />
          <p className="text-[10px] text-gray-400 mt-1">We add this as hidden “schema” on the homepage so Google can understand your brand.</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Sitemap for Google</p>
        <p className="text-xs text-gray-600">
          Your sitemap is generated automatically (programs, sessions, and main pages). Submit this URL in Google Search Console → Sitemaps:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[11px] bg-white px-2 py-1 rounded border break-all flex-1 min-w-0">{sitemapUrl}</code>
          <button
            type="button"
            onClick={() => copy(sitemapUrl)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
          >
            <Copy size={12} /> Copy
          </button>
          <a
            href={sitemapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-purple-700"
          >
            <ExternalLink size={12} /> Open
          </a>
        </div>
        <p className="text-[10px] text-gray-500">
          Tip: Set <strong>Public site URL</strong> above so every link in the sitemap uses your real domain.
        </p>
      </div>
    </div>
  );
};

export default SeoSettingsTab;
