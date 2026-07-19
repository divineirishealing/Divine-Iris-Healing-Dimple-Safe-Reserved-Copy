import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import BlogJournalCupIcon from '../components/BlogJournalCupIcon';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, BODY, SUBTITLE, GOLD, CONTAINER, SECTION_PY, LABEL } from '../lib/designTokens';
import { useSeoPage } from '../context/SeoPageContext';
import { FileText } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const JOURNAL_SAGE = '#7a8f6e';
const JOURNAL_PURPLE = '#534AB7';

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
  const coverSrc = resolveImageUrl(post.hero_image);

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-sm transition-all duration-300 hover:shadow-md"
      style={{ background: '#f9f8fc' }}
      data-testid={`blog-post-card-${post.slug}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10 p-8 md:p-10 md:pr-12">
        <div className="flex-1 min-w-0 order-2 sm:order-1">
          <p
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: JOURNAL_SAGE,
              marginBottom: 14,
            }}
          >
            From the journal
          </p>

          <h2
            style={{
              ...HEADING,
              fontSize: 'clamp(1.45rem, 3vw, 1.85rem)',
              color: JOURNAL_PURPLE,
              lineHeight: 1.3,
              marginBottom: 16,
            }}
          >
            {post.title}
          </h2>

          {post.excerpt && (
            <p
              className="line-clamp-4 max-w-xl"
              style={{
                ...BODY,
                fontSize: '0.95rem',
                color: '#5c5c5c',
                lineHeight: 1.75,
                marginBottom: 20,
              }}
            >
              {post.excerpt}
            </p>
          )}

          <div
            className="mb-5"
            style={{ width: 48, height: 1, background: JOURNAL_SAGE, opacity: 0.85 }}
          />

          <span
            className="inline-flex items-center gap-2 transition-transform group-hover:translate-x-0.5"
            style={{
              fontFamily: 'var(--body-font, "Lato", sans-serif)',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: JOURNAL_PURPLE,
            }}
          >
            Read the full piece
            <span aria-hidden>→</span>
          </span>
        </div>

        <div className="shrink-0 order-1 sm:order-2 sm:pt-1 flex justify-center sm:justify-end sm:w-[140px] md:w-[160px]">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className="w-[120px] h-[120px] sm:w-[130px] sm:h-[130px] object-cover rounded-sm opacity-90 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
          ) : (
            <BlogJournalCupIcon className="w-[100px] h-[120px] sm:w-[120px] sm:h-[140px]" stroke="#c4b8e8" />
          )}
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

      <section className={SECTION_PY} style={{ background: '#faf9fc' }}>
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
            <div className="space-y-8 max-w-3xl mx-auto">
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
