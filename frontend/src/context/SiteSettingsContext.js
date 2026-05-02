import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { rememberPublicApiBase, rememberS3VirtualHostRewrite } from '../lib/imageUtils';
import { getApiUrl } from '../lib/config';

const API = getApiUrl();

// Initialize with an empty object to avoid null access errors
const SiteSettingsContext = createContext({ settings: {}, refreshSettings: () => {} });

export const useSiteSettings = () => useContext(SiteSettingsContext);

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({}); // Default to empty object

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data || {}); // Ensure we don't set null
      applySettings(response.data);
    } catch (error) {
      console.error('Error loading site settings:', error);
    }
  };

  const applySettings = (s) => {
    if (!s) return;
    const apiBase = (s.public_api_base || '').trim().replace(/\/$/, '');
    if (apiBase) rememberPublicApiBase(apiBase);
    rememberS3VirtualHostRewrite(
      (s.s3_media_bucket || '').trim(),
      !!s.s3_proxy_virtual_host_urls,
    );
    const root = document.documentElement;

    // Typography: Lato only (admin heading/body/hero font picks do not change rendered family).
    const headingFont = 'Lato';
    const bodyFont = 'Lato';

    const familyQs = `family=${encodeURIComponent('Lato')}:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700`;
    const existingLink = document.getElementById('dynamic-google-fonts');
    if (existingLink) existingLink.remove();
    const link = document.createElement('link');
    link.id = 'dynamic-google-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${familyQs}&display=swap`;
    document.head.appendChild(link);

    // Apply CSS variables
    root.style.setProperty('--heading-font', `'${headingFont}', sans-serif`);
    root.style.setProperty('--body-font', `'${bodyFont}', sans-serif`);
    root.style.setProperty('--heading-color', s.heading_color || '#1a1a1a');
    root.style.setProperty('--body-color', s.body_color || '#4a4a4a');
    root.style.setProperty('--accent-color', s.accent_color || '#D4AF37');

    // Sizes: html font-size drives rem (section tokens, clamp(), Tailwind rem utilities)
    const headingSizeMap = { small: '0.85', default: '1', large: '1.15', 'extra-large': '1.3' };
    const bodySizeMap = { small: '13px', default: '16px', large: '18px', 'extra-large': '20px' };
    const bodyPx = bodySizeMap[s.body_size] || '16px';
    root.style.setProperty('--heading-scale', headingSizeMap[s.heading_size] || '1');
    root.style.setProperty('--body-size', bodyPx);
    root.style.setProperty('font-size', bodyPx);
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, refreshSettings: loadSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};
