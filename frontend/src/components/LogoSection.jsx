import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const LogoSection = () => {
  const [settings, setSettings] = useState(null);
  useEffect(() => { axios.get(`${API}/settings`).then(r => setSettings(r.data)).catch(() => {}); }, []);

  const logoUrl = settings?.logo_url ? resolveUrl(settings.logo_url) : '';
  const logoWidth = settings?.logo_width || 96;

  if (!logoUrl) return null;

  return (
    <section data-testid="logo-section" className="py-8 bg-white">
      <div className="flex items-center justify-center">
        <img src={logoUrl} alt="Divine Iris Healing" data-testid="site-logo" style={{ width: `${logoWidth}px`, height: 'auto' }} className="object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>
    </section>
  );
};

export default LogoSection;
