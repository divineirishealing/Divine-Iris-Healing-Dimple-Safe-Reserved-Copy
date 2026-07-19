import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import { HEADING, BODY, GOLD, CONTAINER, SECTION_PY, LABEL } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { useSeoPage } from '../context/SeoPageContext';
import { renderMarkdown } from '../lib/renderMarkdown';
import { formatDateDMonYyyyUpper } from '../lib/utils';
import { ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BlogPostDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { setPageSeo, clearPageSeo } = useSeoPage();

  useEffect(() => {
    if (!post) return;
    setPageSeo({
      title: post.title,
      description: post.excerpt || post.title,
      ogImage: post.hero_image ? resolveImageUrl(post.hero_image) : undefined,
    });
    return () => clearPageSeo();
  }, [post, setPageSeo, clearPageSeo]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    axios
      .get(`${API}/blog-posts/slug/${slug}?visible_only=true`)
      .then((r) => setPost(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className={`${CONTAINER} ${SECTION_PY} text-center`}>
          <h1 style={{ ...HEADING, color: '#4c1d95' }}>Article not found</h1>
          <Link to="/blog" className="inline-flex items-center gap-2 mt-6 text-purple-700 font-semibold">
            <ArrowLeft size={16} /> Back to blog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const heroSrc = resolveImageUrl(post.hero_image);
  const dateLabel = post.published_at ? formatDateDMonYyyyUpper(post.published_at) : '';

  return (
    <div className="min-h-screen bg-white" data-testid={`blog-post-detail-${post.slug}`}>
      <Header />

      <section
        className="relative pt-24 pb-16 px-6 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0654 0%, #2d1a5e 50%, #fdfbff 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,55,0.4) 0%, transparent 70%)',
          }}
        />
        <div className={`${CONTAINER} relative z-10 max-w-4xl`}>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> All articles
          </Link>
          {(dateLabel || post.author) && (
            <p style={{ ...LABEL, color: GOLD, marginBottom: 12 }}>
              {[dateLabel, post.author].filter(Boolean).join(' · ')}
            </p>
          )}
          <h1
            className="text-white mb-4"
            style={{ ...HEADING, fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', lineHeight: 1.25 }}
          >
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-white/80" style={{ ...BODY, lineHeight: 1.75, fontSize: '1.05rem' }}>
              {post.excerpt}
            </p>
          )}
        </div>
      </section>

      {heroSrc && (
        <section className="px-6 -mt-8 relative z-10">
          <div className={`${CONTAINER} max-w-4xl`}>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-purple-100">
              <img src={heroSrc} alt={post.title} className="w-full h-auto object-cover max-h-[480px]" />
            </div>
          </div>
        </section>
      )}

      <section className={SECTION_PY}>
        <div className={`${CONTAINER} max-w-3xl`}>
          <article
            className="rounded-2xl p-6 md:p-10 whitespace-pre-line"
            style={{
              background: 'rgba(250,245,255,0.6)',
              border: '1px solid rgba(109,40,217,0.1)',
              ...BODY,
              fontSize: '1.05rem',
              lineHeight: 1.85,
              color: '#374151',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
          />
        </div>
      </section>

      <section className="pb-16 px-6">
        <div className={`${CONTAINER} max-w-3xl text-center`}>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
            style={{ background: GOLD, color: '#1e0654' }}
          >
            <ArrowLeft size={14} /> More articles
          </Link>
        </div>
      </section>

      <Footer />
      <FloatingButtons />
    </div>
  );
}
