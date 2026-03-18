import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    const root = document.documentElement;

    // Load Google Fonts dynamically
    const fonts = [s.heading_font, s.body_font].filter(Boolean).join('|').replace(/ /g, '+');
    const existingLink = document.getElementById('dynamic-google-fonts');
    if (existingLink) existingLink.remove();
    const link = document.createElement('link');
    link.id = 'dynamic-google-fonts';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.heading_font)}:wght@300;400;500;600;700&family=${encodeURIComponent(s.body_font)}:wght@300;400;700&display=swap`;
    document.head.appendChild(link);

    // Apply CSS variables
    root.style.setProperty('--heading-font', `'${s.heading_font}', Georgia, serif`);
    root.style.setProperty('--body-font', `'${s.body_font}', sans-serif`);
    root.style.setProperty('--heading-color', s.heading_color);
    root.style.setProperty('--body-color', s.body_color);
    root.style.setProperty('--accent-color', s.accent_color);

    // Apply sizes
    const headingSizeMap = { small: '0.85', default: '1', large: '1.15', 'extra-large': '1.3' };
    const bodySizeMap = { small: '13px', default: '16px', large: '18px', 'extra-large': '20px' };
    root.style.setProperty('--heading-scale', headingSizeMap[s.heading_size] || '1');
    root.style.setProperty('--body-size', bodySizeMap[s.body_size] || '16px');
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, refreshSettings: loadSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};
