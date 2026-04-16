import React, { useMemo } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import ImageUploader from '../ImageUploader';
import CollapsibleSection from '../CollapsibleSection';
import { resolveImageUrl } from '../../../lib/imageUtils';
import { useToast } from '../../../hooks/use-toast';
import { Search, Copy, ExternalLink, Info, CheckCircle2, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function charCountHint(len, min, max, label) {
  if (len === 0) return { text: `${label}: empty`, ok: 'muted' };
  if (len < min) return { text: `${len} characters — a bit short (aim ${min}–${max})`, ok: 'warn' };
  if (len <= max) return { text: `${len} characters — good range for ${label}`, ok: 'good' };
  return { text: `${len} characters — Google may shorten this (trim toward ${max})`, ok: 'warn' };
}

const SeoSettingsTab = ({ settings, onChange }) => {
  const { toast } = useToast();
  const s = settings;
  const set = (key, val) => onChange({ ...s, [key]: val });

  const sitemapUrl = `${BACKEND_URL}/api/sitemap.xml`;
  const desc = (s.seo_default_description || '').length;
  const titleLen = (s.seo_default_title || '').length;
  const descHint = useMemo(() => charCountHint(desc, 120, 160, 'search snippets'), [desc]);
  const titleHint = useMemo(() => charCountHint(titleLen, 30, 60, 'titles in Google'), [titleLen]);

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard' });
    }).catch(() => {
      toast({ title: 'Could not copy', variant: 'destructive' });
    });
  };

  const previewTitle =
    (s.seo_default_title || 'Your site title').length > 70
      ? `${(s.seo_default_title || '').slice(0, 67)}…`
      : s.seo_default_title || 'Your site title';
  const previewUrl = (s.seo_site_url || 'https://divineirishealing.com').replace(/\/$/, '') || 'https://divineirishealing.com';
  const previewDesc =
    (s.seo_default_description || 'Your description will appear here. Write 1–2 sentences: who you help, what you offer, and your location or niche.')
      .length > 160
      ? `${(s.seo_default_description || '').slice(0, 157)}…`
      : s.seo_default_description ||
        'Your description will appear here. Write 1–2 sentences: who you help, what you offer, and your location or niche.';

  const hintColor = (ok) =>
    ok === 'good' ? 'text-emerald-700' : ok === 'warn' ? 'text-amber-700' : 'text-gray-400';

  return (
    <div data-testid="seo-settings-tab" className="space-y-5 pb-8">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Search className="w-5 h-5 text-[#D4AF37]" /> Search &amp; social (SEO)
        </h2>
        <p className="text-sm text-gray-600 max-w-3xl leading-relaxed">
          This screen controls the <strong>title</strong>, <strong>short description</strong>, and <strong>share image</strong> that Google,
          WhatsApp, Facebook, and LinkedIn use when people find or share your site. Your <strong>program</strong> and <strong>session</strong> pages
          get their own titles automatically from the program/session name. Everything here is saved to your database — no code needed.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          After editing, scroll to the bottom and click <strong className="text-[#b8962e]">Save Changes</strong> (same as Hero Banner and other Website tabs).
        </p>
      </div>

      {/* Google-style preview */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approximate Google preview (homepage)</p>
        <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 max-w-[600px]">
          <p className="text-[#1a0dab] text-lg leading-snug hover:underline cursor-default truncate">{previewTitle}</p>
          <p className="text-xs text-[#006621] mt-0.5 truncate">{previewUrl}/</p>
          <p className="text-sm text-[#545454] mt-1.5 leading-relaxed line-clamp-3">{previewDesc}</p>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Real results vary by device and Google’s rules. This is a rough guide only.
        </p>
      </div>

      {/* Master checklist */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-100 rounded-xl p-5 text-sm text-amber-950 space-y-3">
        <p className="font-semibold flex items-center gap-2 text-amber-900">
          <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" /> Step-by-step (first time ~20 minutes)
        </p>
        <ol className="list-decimal list-inside space-y-2.5 text-amber-900/90 leading-relaxed pl-1">
          <li>
            <strong>Public site URL</strong> — Enter the exact address visitors use (usually <code className="text-[11px] bg-white/70 px-1 rounded">https://yourdomain.com</code>, no slash at the end).
            This fixes “canonical” links so Google knows which URL is official.
          </li>
          <li>
            <strong>Homepage title</strong> — Your brand name plus an optional short phrase (e.g. “Divine Iris Healing | Soulful Healing Studio”).
            Keep it readable; very long titles get cut off in search.
          </li>
          <li>
            <strong>Default description</strong> — Two sentences: who you serve, what transformation you offer, and city/region if relevant.
            This text is reused as a fallback when a page doesn’t have its own snippet.
          </li>
          <li>
            <strong>Share image</strong> — Upload a wide image (ideally <strong>1200 × 630</strong> pixels). It appears when someone pastes your link in WhatsApp or social apps.
            If you skip it, we may fall back to your logo.
          </li>
          <li>
            <strong>Google Search Console</strong> —{' '}
            <a className="underline font-medium text-amber-800" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">
              Open Search Console
            </a>
            , add your website as a “property”, verify ownership (Google will show you a simple method), then go to <strong>Sitemaps</strong> and submit the sitemap URL from the bottom of this page.
          </li>
          <li>
            Optional: repeat sitemap submission in{' '}
            <a className="underline font-medium text-amber-800" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">
              Bing Webmaster Tools
            </a>{' '}
            for Microsoft/Bing search.
          </li>
        </ol>
      </div>

      <CollapsibleSection title="What this site does automatically for SEO" subtitle="Programs, sessions, admin…" defaultOpen={false}>
        <ul className="text-xs text-gray-600 space-y-2 leading-relaxed list-disc list-inside max-w-3xl">
          <li>
            <strong>Program pages</strong> (<code className="text-[10px] bg-gray-100 px-1">/program/…</code>) use the program title and description for the browser tab and share text when possible.
          </li>
          <li>
            <strong>Session pages</strong> (<code className="text-[10px] bg-gray-100 px-1">/session/…</code>) use the session title and description similarly.
          </li>
          <li>
            <strong>Main pages</strong> (Programs list, About, Contact, Transformations, etc.) use short default descriptions defined in the site — you can refine wording over time in code if needed; the homepage and fallbacks use the fields on this screen.
          </li>
          <li>
            <strong>Admin, checkout, dashboard, and payment pages</strong> are marked <code className="text-[10px] bg-gray-100 px-1">noindex</code> so they normally don’t appear in Google.
          </li>
          <li>
            The <strong>sitemap</strong> lists your important public URLs (and visible programs/sessions) so Google can discover them faster.
          </li>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Glossary (plain English)" subtitle="Canonical, OG, schema…" defaultOpen={false}>
        <dl className="text-xs text-gray-600 space-y-3 max-w-3xl">
          <dt className="font-semibold text-gray-800">Canonical URL</dt>
          <dd className="ml-0 pl-0 border-l-2 border-gray-200 pl-3">The “official” version of a page. Setting your public site URL helps Google consolidate rankings on your real domain.</dd>
          <dt className="font-semibold text-gray-800">Meta description</dt>
          <dd className="ml-0 border-l-2 border-gray-200 pl-3">The short paragraph under the blue link in Google. It doesn’t directly change ranking, but a good one improves clicks.</dd>
          <dt className="font-semibold text-gray-800">Open Graph (OG) image</dt>
          <dd className="ml-0 border-l-2 border-gray-200 pl-3">The preview image social apps show when your link is shared.</dd>
          <dt className="font-semibold text-gray-800">Structured data / schema</dt>
          <dd className="ml-0 border-l-2 border-gray-200 pl-3">Hidden JSON that tells Google your organization name and links; helps brand panels in search.</dd>
          <dt className="font-semibold text-gray-800">Sitemap</dt>
          <dd className="ml-0 border-l-2 border-gray-200 pl-3">A machine-readable list of URLs. You submit its address once in Search Console; Google rechecks it periodically.</dd>
        </dl>
      </CollapsibleSection>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-5">
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <Info className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
          <span><strong>Basics</strong> — These four fields are the highest impact for search and sharing.</span>
        </div>

        <div>
          <Label className="text-xs font-medium text-gray-700">1. Public site URL (canonical base)</Label>
          <Input
            value={s.seo_site_url || ''}
            onChange={(e) => set('seo_site_url', e.target.value.trim())}
            placeholder="https://divineirishealing.com"
            className="mt-1.5"
          />
          <ul className="text-[11px] text-gray-500 mt-2 space-y-1 list-disc list-inside">
            <li>Use <strong>https</strong> and your real live domain (the one on Vercel / your DNS).</li>
            <li>Do <strong>not</strong> add a trailing slash.</li>
            <li>Used for canonical tags and for building correct links inside the XML sitemap.</li>
          </ul>
        </div>

        <div>
          <Label className="text-xs font-medium text-gray-700">2. Homepage title (browser tab &amp; Google)</Label>
          <Input
            value={s.seo_default_title || ''}
            onChange={(e) => set('seo_default_title', e.target.value)}
            placeholder="Divine Iris Healing | Soulful Healing Studio"
            className="mt-1.5"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {titleHint.ok === 'good' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : titleHint.ok === 'warn' ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> : null}
            <span className={`text-[11px] ${hintColor(titleHint.ok)}`}>{titleHint.text}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Other pages often show as <em>“Page name | Brand”</em> using your organization name from section 5 below.</p>
        </div>

        <div>
          <Label className="text-xs font-medium text-gray-700">3. Default meta description</Label>
          <Textarea
            value={s.seo_default_description || ''}
            onChange={(e) => set('seo_default_description', e.target.value)}
            rows={5}
            placeholder="Example: Energy healing and spiritual mentoring for people ready to release stress and reconnect with clarity. Based in Dubai; sessions online worldwide."
            className="mt-1.5"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {descHint.ok === 'good' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : descHint.ok === 'warn' ? <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> : null}
            <span className={`text-[11px] ${hintColor(descHint.ok)}`}>{descHint.text}</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Shown on the homepage and anywhere we don’t have a more specific description. Include a clear benefit, not only keywords.
          </p>
        </div>

        <div>
          <Label className="text-xs font-medium text-gray-700">4. Keywords (optional)</Label>
          <Input
            value={s.seo_keywords || ''}
            onChange={(e) => set('seo_keywords', e.target.value)}
            placeholder="energy healing, Dubai, nervous system, spiritual healing, transformation"
            className="mt-1.5"
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Comma-separated. Google largely ignores this tag today; your <strong>description</strong> and <strong>page content</strong> matter more.
            Still useful as a private reminder of topics you want to be known for.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">5. Social share image (Open Graph)</p>
        <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
          When someone shares your homepage (or a page without its own image), apps like WhatsApp and Facebook look for this image.
          Use a horizontal image; <strong>1200 × 630 px</strong> is the standard. Keep important text and faces in the centre — edges may be cropped on phones.
        </p>
        <ImageUploader
          value={s.seo_og_image_url || ''}
          onChange={(url) => set('seo_og_image_url', url)}
        />
        {s.seo_og_image_url && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500">Preview:</p>
            <img src={resolveImageUrl(s.seo_og_image_url)} alt="" className="max-w-lg w-full rounded-lg border border-gray-200 shadow-sm" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">6. Twitter / X (optional)</p>
        <p className="text-xs text-gray-600">Adds your handle to Twitter card metadata when links are shared on X.</p>
        <div>
          <Label className="text-xs text-gray-500">Username only (no @)</Label>
          <Input
            value={s.seo_twitter_handle || ''}
            onChange={(e) => set('seo_twitter_handle', e.target.value.replace(/^@/, ''))}
            placeholder="divineirishealing"
            className="mt-1.5 max-w-md"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border space-y-4">
        <p className="text-sm font-semibold text-gray-800">7. Organization info (Google structured data)</p>
        <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
          We output invisible <strong>JSON-LD</strong> on the homepage so Google can connect your site name, description, logo, and social profiles.
          Align this with how you introduce yourself on your About page.
        </p>
        <div>
          <Label className="text-xs text-gray-500">Legal or brand name</Label>
          <Input
            value={s.seo_organization_name || ''}
            onChange={(e) => set('seo_organization_name', e.target.value)}
            placeholder="Divine Iris Healing"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">One-paragraph organization description</Label>
          <Textarea
            value={s.seo_organization_description || ''}
            onChange={(e) => set('seo_organization_description', e.target.value)}
            rows={4}
            placeholder="What you do, who you serve, and what makes your approach unique."
            className="mt-1.5"
          />
        </div>
        <p className="text-[10px] text-gray-400">
          Social profile URLs are taken from your <strong>Header &amp; Footer</strong> settings when available (Instagram, Facebook, YouTube, LinkedIn).
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
        <p className="text-sm font-semibold text-gray-800">8. XML sitemap (for Google &amp; Bing)</p>
        <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
          This file is generated on your <strong>server</strong> (Render). It lists public URLs including each <strong>visible</strong> program and session.
          You don’t edit the file by hand — you only <strong>submit the URL once</strong> in Search Console (and optionally Bing).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[11px] bg-white px-3 py-2 rounded-lg border border-gray-200 break-all flex-1 min-w-0">{sitemapUrl}</code>
          <button
            type="button"
            onClick={() => copy(sitemapUrl)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 shadow-sm"
          >
            <Copy size={12} /> Copy URL
          </button>
          <a
            href={sitemapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-purple-700 shadow-sm"
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
        </div>
        <div className="text-[11px] text-gray-600 space-y-2 border-t border-gray-200 pt-3">
          <p><strong>If links inside the sitemap look wrong</strong> (e.g. still say example.com): set <strong>Public site URL</strong> in section 1, save, then in Search Console use “Inspect URL” on your homepage and request indexing again after a few days.</p>
          <p><strong>If the sitemap won’t open:</strong> your backend may be sleeping (Render free tier). Open any page on the site, wait a minute, try the sitemap link again.</p>
        </div>
      </div>
    </div>
  );
};

export default SeoSettingsTab;
