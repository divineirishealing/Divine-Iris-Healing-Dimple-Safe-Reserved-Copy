import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import BlogJournalCupIcon from '../components/BlogJournalCupIcon';
import { resolveImageUrl } from '../lib/imageUtils';
import { HEADING, BODY, GOLD, CONTAINER, SECTION_PY, LABEL, applyPageHeroStyle } from '../lib/designTokens';
import { useSeoPage } from '../context/SeoPageContext';
import { FileText } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const JOURNAL_SAGE = '#7a8f6e';
const JOURNAL_PURPLE = '#534AB7';

function BlogPostCard({ post }) {
  const coverSrc = resolveImageUrl(post.hero_image);

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block border-b border-[#e8e4f0] py-10 first:pt-0 last:border-b-0 transition-colors hover:bg-white/60"
      data-testid={`blog-post-card-${post.slug}`}
    >
      <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-12">
        <div className="flex-1 min-w-0 text-left">
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
              className="line-clamp-4 max-w-2xl"
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

        <div className="shrink-0 md:w-[150px] lg:w-[170px] flex justify-start md:justify-end">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className="w-[130px] h-[130px] md:w-[150px] md:h-[150px] object-cover rounded-sm opacity-95 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
          ) : (
            <BlogJournalCupIcon className="w-[110px] h-[130px] md:w-[130px] md:h-[150px]" stroke="#c4b8e8" />
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
  const kicker = hero.subtitle_text || 'Insights, stories and updates';
  const heroBody = hero.body_text || 'Reflections from our healing community — written to meet you where you are.';

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section
        data-testid="blog-hero"
        className="relative min-h-[45vh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-16"
        style={{
          background: hero.hero_image
            ? 'transparent'
            : 'linear-gradient(135deg, #1a0654 0%, #2d1a5e 55%, #3d2a6e 100%)',
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
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.35) 0%, transparent 70%)',
          }}
        />
        <div className={`${CONTAINER} relative z-10 w-full`}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <FileText size={16} style={{ color: GOLD }} />
              <p style={{ ...LABEL, color: GOLD, letterSpacing: '0.28em' }}>From the journal</p>
            </div>
            <h1
              className="text-white mb-4"
              style={applyPageHeroStyle(
                hero.title_style,
                {
                  ...HEADING,
                  color: '#ffffff',
                  fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                  lineHeight: 1.2,
                  letterSpacing: '0.04em',
                },
                { lockColor: true },
              )}
            >
              {hero.title_text || 'Blog'}
            </h1>
            <p
              className="text-white/85 max-w-2xl mx-auto mb-2"
              style={applyPageHeroStyle(
                hero.subtitle_style,
                { ...BODY, fontSize: '1rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.85)' },
                { lockColor: true },
              )}
            >
              {kicker}
            </p>
            {heroBody && (
              <p className="text-white/65 max-w-2xl mx-auto text-sm md:text-base" style={{ ...BODY, lineHeight: 1.7, color: 'rgba(255,255,255,0.65)' }}>
                {heroBody}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={`${SECTION_PY} bg-[#faf9fc]`}>
        <div className={CONTAINER}>
          {loading ? (
            <div className="flex justify-start py-20">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="max-w-2xl py-16 text-left">
              <p className="text-gray-500 text-sm">Blog posts coming soon. Check back for new articles.</p>
            </div>
          ) : (
            <div className="max-w-4xl">
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
