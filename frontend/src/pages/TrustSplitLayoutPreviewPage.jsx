import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TextTestimonialsStrip from '../components/TextTestimonialsStrip';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Local-only layout preview — not linked from production nav.
 * Open in dev: http://localhost:3000/preview/trust-split
 */
const TrustSplitLayoutPreviewPage = () => {
  const [sectionConfig, setSectionConfig] = useState({ layout_mode: 'split_before_after' });
  const [transformations, setTransformations] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/settings`),
      axios.get(`${API}/testimonials`, { params: { visible_only: true, type: 'template' } }),
    ])
      .then(([settingsRes, testimonialsRes]) => {
        const homeSections = settingsRes.data?.homepage_sections || [];
        const trustSec = homeSections.find((s) => s.id === 'trust' || s.id === 'text_testimonials') || {};
        setSectionConfig({
          ...trustSec,
          layout_mode: 'split_before_after',
        });

        const items = (testimonialsRes.data || []).filter(
          (t) =>
            t.photo_mode === 'before_after'
            || (t.before_image && t.image)
            || (Array.isArray(t.photos) && t.photos.length >= 2),
        );
        setTransformations(items);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div
        className="sticky top-0 z-[60] py-2.5 px-4 text-center text-xs font-medium tracking-wide"
        style={{ background: 'linear-gradient(90deg, #fef3c7, #fde68a, #fef3c7)', color: '#92400e', borderBottom: '1px solid #fcd34d' }}
        data-testid="trust-split-preview-banner"
      >
        Local preview only — this split layout is not on the live homepage. Compare at /preview/trust-split
      </div>
      <Header />
      <main>
        <TextTestimonialsStrip sectionConfig={sectionConfig} transformationShowcase={transformations} />
      </main>
      <Footer />
    </>
  );
};

export default TrustSplitLayoutPreviewPage;
