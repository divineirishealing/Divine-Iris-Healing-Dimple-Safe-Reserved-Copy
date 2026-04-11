import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useSeoPage } from '../context/SeoPageContext';
import { getRouteSeo } from '../lib/seoRoutes';
import { resolveImageUrl } from '../lib/imageUtils';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

function absoluteUrl(maybeRelative) {
  if (!maybeRelative) return '';
  const s = String(maybeRelative).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/api/') || s.startsWith('api/')) {
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${BACKEND}${path}`;
  }
  if (typeof window !== 'undefined' && s.startsWith('/')) {
    return `${window.location.origin}${s}`;
  }
  return s;
}

/**
 * Global SEO: titles, descriptions, Open Graph, Twitter, canonical, Organization JSON-LD.
 * Per-page overrides: useSeoPage().setPageSeo({ title, description, ogImage }) in route components.
 */
export default function SeoHead() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const { pageSeo } = useSeoPage();

  const brand =
    settings?.seo_organization_name ||
    settings?.footer_brand_name ||
    'Divine Iris Healing';
  const defaultTitle = settings?.seo_default_title || brand;
  const defaultDesc =
    settings?.seo_default_description ||
    'Transform your life through sacred healing, energy work and spiritual growth.';
  const siteUrl = (settings?.seo_site_url || '').replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const canonical = `${siteUrl}${pathname || '/'}`;
  const routeSeo = getRouteSeo(pathname);

  const fullTitle = useMemo(() => {
    if (pathname === '/') return defaultTitle;
    if (pageSeo.title) return `${pageSeo.title} | ${brand}`;
    if (routeSeo?.title) return `${routeSeo.title} | ${brand}`;
    return brand;
  }, [pathname, defaultTitle, brand, pageSeo.title, routeSeo]);

  const description = useMemo(() => {
    return (
      pageSeo.description ||
      routeSeo?.description ||
      defaultDesc
    );
  }, [pageSeo.description, routeSeo, defaultDesc]);

  const ogImage = useMemo(() => {
    const raw =
      pageSeo.ogImage ||
      settings?.seo_og_image_url ||
      settings?.logo_url ||
      '';
    const resolved = resolveImageUrl(raw) || raw;
    return absoluteUrl(resolved);
  }, [pageSeo.ogImage, settings?.seo_og_image_url, settings?.logo_url]);

  const twitterHandle = (settings?.seo_twitter_handle || '').replace(/^@/, '');
  const keywords = (settings?.seo_keywords || '').trim();

  const noIndexPrivate =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/payment/') ||
    pathname.startsWith('/checkout/') ||
    pathname.startsWith('/enroll/') ||
    pathname.startsWith('/india-payment/') ||
    pathname.startsWith('/manual-payment') ||
    pathname.startsWith('/cart/checkout');
  const noIndex = noIndexPrivate || pageSeo.noIndex;
  const orgJsonLd = useMemo(() => {
    if (pathname !== '/') return null;
    const sameAs = [
      settings?.social_instagram,
      settings?.social_facebook,
      settings?.social_youtube,
      settings?.social_linkedin,
    ].filter(Boolean);
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: settings?.seo_organization_name || brand,
      description:
        settings?.seo_organization_description ||
        defaultDesc,
      url: siteUrl || undefined,
      logo: ogImage || undefined,
      sameAs: sameAs.length ? sameAs : undefined,
    };
    return JSON.stringify(org);
  }, [pathname, settings, brand, defaultDesc, siteUrl, ogImage]);

  return (
    <Helmet prioritizeSeoTags htmlAttributes={{ lang: 'en' }}>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={brand} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}

      <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {twitterHandle ? <meta name="twitter:site" content={`@${twitterHandle}`} /> : null}
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}

      {orgJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />
      ) : null}
    </Helmet>
  );
}
