import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, BODY, SUBTITLE, GOLD, CONTAINER, SECTION_PY, LABEL } from '../lib/designTokens';
import { useSeoPage } from '../context/SeoPageContext';
import { formatDateDMonYyyyUpper } from '../lib/utils';
import { ArrowRight, FileText } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const applyHeroStyle = (styleObj, defaults = {}) => {
  if (!styleObj || Object.keys(styleObj).length === 0) return defaults;
  return {
    ...defaults,
    ...(styleObj.font_family && { fontFamily: styleObj.font_family }),
    ...(styleObj.font_size && { fontSize: styleObj.font_size }),
    ...(styleObj.font_color && { color: styleObj.font_color }),
    ...(styleObj.font_weight && { fontWeight: styleObj.font_weight }),
    ...(styleObj.font_style && { fontStyle: styleObj.font_style }),
  };
};

function BlogPostCard({ post }) {
  const heroSrc = resolveImageUrl(post.hero_image);
  const dateLabel = post.published_at ? formatDateDMonYyyyUpper(post.published_at) : '';

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{ border: '1.5px solid rgba(109,40,217,0.18)', background: '#fdfbff' }}
      data-testid={`blog-post-card-${post.slug}`}
    >
      {heroSrc ? (
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={heroSrc}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e0654]/80 via-transparent to-transparent" />
          {post.featured && (
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: 'linear-gradient(135deg,#D4AF37,#b8860b)' }}
            >
              Featured
            </span>
          )}
        </div>
      ) : (
        <div
          className="relative aspect-[16/10] flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1e0654 0%, #6d28d9 100%)' }}
        >
          <FileText size={40} className="text-white/30" />
        </div>
      )}
      <div className="p-6">
        {(dateLabel || post.author) && (
          <p style={{ ...LABEL, fontSize: '10px', color: GOLD, marginBottom: 8 }}>
            {[dateLabel, post.author].filter(Boolean).join(' · ')}
          </p>
        )}
        <h2 style={{ ...HEADING, fontSize: '1.25rem', color: '#4c1d95', lineHeight: 1.35 }}>{post.title}</h2>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3" style={{ ...BODY, fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.7 }}>
            {post.excerpt}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold" style={{ color: '#7c3aed' }}>
          Read article <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [settings, setSettings] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setPageSeo, clearPageSeo } = useSeoPage();

  useEffect(() => {
    setPageSeo({
      title: 'Blog',
      description: 'Insights, healing stories, and updates from Divine Iris Healing.',
    });
    return () => clearPageSeo();
  }, [setPageSeo, clearPageSeo]);

  useEffect(() => {
    window.scrollTo(0, 0);
    Promise.all([
      axios.get(`${API}/settings`).catch(() => ({ data: null })),
      axios.get(`${API}/blog-posts?visible_only=true`).catch(() => ({ data: [] })),
    ]).then(([settingsRes, postsRes]) => {
      setSettings(settingsRes.data);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const hero = settings?.page_heroes?.blog || {};

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section
        data-testid="blog-hero"
        className="relative min-h-[45vh] flex flex-col items-center justify-center text-center px-6 pt-20"
        style={{
          background: hero.hero_image
            ? 'transparent'
            : 'linear-gradient(180deg, #1a1a1a 0%, #1a0654 60%, #2d1a5e 100%)',
        }}
      >
        {hero.hero_image && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${resolveImageUrl(hero.hero_image)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="absolute inset-0" style={{ background: '#000', opacity: (hero.overlay_opacity || 60) / 100 }} />
          </>
        )}
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText size={18} style={{ color: GOLD }} />
            <p style={{ ...LABEL, color: GOLD }}>INSIGHTS & UPDATES</p>
          </div>
          <h1
            className="mb-2 text-white"
            style={applyHeroStyle(hero.title_style, {
              ...HEADING,
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontVariant: 'small-caps',
              letterSpacing: '0.08em',
            })}
          >
            {hero.title_text || 'Blog'}
          </h1>
          <p
            className="text-white/80 max-w-xl mx-auto"
            style={applyHeroStyle(hero.subtitle_style, { ...SUBTITLE, color: '#ccc' })}
          >
            {hero.subtitle_text || 'Insights, stories and updates from our healing community'}
          </p>
        </div>
      </section>

      <section className={SECTION_PY}>
        <div className={CONTAINER}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="max-w-3xl mx-auto text-center py-20">
              <p className="text-gray-400 text-sm">Blog posts coming soon. Check back for new articles.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
