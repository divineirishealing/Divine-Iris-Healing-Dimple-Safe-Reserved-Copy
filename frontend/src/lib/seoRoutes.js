/**
 * Default title + meta description per URL (when a page does not set its own via useSeoPage).
 * Title on the site becomes: "{title} | {brand}" except homepage uses full default title from Admin → SEO.
 */
export const SEO_ROUTE_TABLE = {
  '/programs': {
    title: 'Healing Programs',
    description: 'Explore transformational healing programs, courses and sacred journeys with Divine Iris — online and in person.',
  },
  '/sessions': {
    title: 'Sessions & Workshops',
    description: 'Book healing sessions, workshops and sacred circles with Divine Iris Soulful Healing Studio.',
  },
  '/services': {
    title: 'Services',
    description: 'Energy healing, spiritual mentoring and soulful support services tailored to your path.',
  },
  '/contact': {
    title: 'Contact',
    description: 'Get in touch with Divine Iris Healing — we respond with care to every message.',
  },
  '/about': {
    title: 'About',
    description: 'Meet Dimple Ranawat and discover the heart behind Divine Iris Soulful Healing Studio.',
  },
  '/transformations': {
    title: 'Transformations',
    description: 'Stories, testimonials and transformations from clients of Divine Iris Healing.',
  },
  '/sponsor': {
    title: 'Sponsor & Support',
    description: 'Shine a light in a life — conscious support and sponsorship for collective healing.',
  },
  '/terms': {
    title: 'Terms of Use',
    description: 'Terms and conditions for using Divine Iris Healing services and website.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'How Divine Iris Healing collects, uses and protects your information.',
  },
  '/refund-cancellation': {
    title: 'Refund & Cancellation Policy',
    description: 'Refunds, cancellations and administrative fees for Divine Iris Healing programs and services.',
  },
  '/blog': {
    title: 'Blog',
    description: 'Articles and insights on healing, awareness and transformation from Divine Iris.',
  },
  '/media': {
    title: 'Media',
    description: 'Video and media from Divine Iris Healing — talks, testimonials and teachings.',
  },
  '/cart': {
    title: 'Cart',
    description: 'Review your selected programs and sessions before checkout.',
  },
  '/login': {
    title: 'Sign In',
    description: 'Sign in to your Divine Iris student dashboard and sanctuary.',
  },
};

export function getRouteSeo(pathname) {
  if (!pathname) return null;
  const exact = SEO_ROUTE_TABLE[pathname];
  if (exact) return exact;
  return null;
}
