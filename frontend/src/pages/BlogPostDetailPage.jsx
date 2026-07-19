import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FloatingButtons from '../components/FloatingButtons';
import DocxHtmlMirror from '../components/DocxHtmlMirror';
import { BODY, CONTAINER, SECTION_PY } from '../lib/designTokens';
import { resolveImageUrl } from '../lib/imageUtils';
import { useSeoPage } from '../context/SeoPageContext';
import { renderMarkdown } from '../lib/renderMarkdown';
import { isDocxHtmlBody, extractDocxHtml, wrapDocxHtmlFragment } from '../lib/docxHtml';
import { ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Same column width as DocxHtmlMirror / Word page (816px + horizontal padding). */
const DOC_COLUMN = 'docx-page mx-auto w-full max-w-[816px] px-6 md:px-[72px]';

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
        <div className={`${CONTAINER} ${SECTION_PY} text-left`}>
          <h1 className="text-2xl font-serif text-[#534AB7]">Article not found</h1>
          <Link to="/blog" className="inline-flex items-center gap-2 mt-6 text-purple-700 font-semibold">
            <ArrowLeft size={16} /> Back to blog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const heroSrc = resolveImageUrl(post.hero_image);
  const bodyIsDocx = isDocxHtmlBody(post.body);
  const docxHtml = bodyIsDocx ? wrapDocxHtmlFragment(extractDocxHtml(post.body), 'article') : '';
  const showCoverBanner = heroSrc && !bodyIsDocx;

  return (
    <div className="min-h-screen bg-white" data-testid={`blog-post-detail-${post.slug}`}>
      <Header />

      <div className="bg-white pt-24 pb-3">
        <div className={DOC_COLUMN}>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-[#7c6fa8] hover:text-[#534AB7] text-sm transition-colors"
          >
            <ArrowLeft size={14} /> Back to the journal
          </Link>
        </div>
      </div>

      {showCoverBanner && (
        <section className="bg-white border-b border-[#ebe6f2]">
          <div className={`${DOC_COLUMN} py-6`}>
            <img
              src={heroSrc}
              alt={post.title}
              className="w-full max-h-[420px] object-cover rounded-sm"
            />
          </div>
        </section>
      )}

      {post.body && (
        bodyIsDocx ? (
          <DocxHtmlMirror html={docxHtml} continuation />
        ) : (
          <section className={`${SECTION_PY} bg-white`}>
            <div className={DOC_COLUMN}>
              <article
                className="whitespace-pre-line"
                style={{
                  ...BODY,
                  fontSize: '1.05rem',
                  lineHeight: 1.85,
                  color: '#374151',
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
              />
            </div>
          </section>
        )
      )}

      <Footer />
      <FloatingButtons />
    </div>
  );
}
