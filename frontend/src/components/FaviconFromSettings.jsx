import { useEffect } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { resolveImageUrl } from '../lib/imageUtils';

/** Set favicon from cached/live site settings — avoids a duplicate /api/settings fetch in App. */
export default function FaviconFromSettings() {
  const { settings } = useSiteSettings();

  useEffect(() => {
    const logo = settings?.logo_url;
    if (!logo) return;
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = resolveImageUrl(logo);
    document.head.appendChild(link);
  }, [settings?.logo_url]);

  return null;
}
