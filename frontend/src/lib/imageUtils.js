import { BACKEND_URL as CONFIG_BACKEND_URL } from './config';

const PUBLIC_API_STORAGE_KEY = 'divine_iris_public_api_base';
const S3_VH_REWRITE_KEY = 'divine_iris_s3_vh_rewrite';

/** When the API sets s3_proxy_virtual_host_urls, store bucket name so resolveImageUrl can map private S3 URLs to /api/s3-media/... */
export function rememberS3VirtualHostRewrite(bucket, enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled && bucket) {
      sessionStorage.setItem(S3_VH_REWRITE_KEY, JSON.stringify({ bucket, enabled: true }));
    } else {
      sessionStorage.removeItem(S3_VH_REWRITE_KEY);
    }
  } catch (_) {
    /* private mode / quota */
  }
}

/** Call when /api/settings loads — HOST_URL from the server helps /api/image URLs if the bundle lacked REACT_APP_BACKEND_URL. */
export function rememberPublicApiBase(url) {
  if (typeof window === 'undefined' || url == null) return;
  const u = String(url).trim().replace(/\/$/, '');
  if (!u) return;
  try {
    sessionStorage.setItem(PUBLIC_API_STORAGE_KEY, u);
  } catch (_) {
    /* private mode / quota */
  }
}

/**
 * Origin for resolving /api/... media paths — build-time env first, then server-reported public_api_base.
 */
function backendOrigin() {
  const env = (CONFIG_BACKEND_URL || '').replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PUBLIC_API_STORAGE_KEY);
      if (stored) return stored.replace(/\/$/, '');
    } catch (_) {}
  }
  return '';
}

function tryRewriteS3VirtualHostUrl(url, bucket, apiBase) {
  if (!url || !bucket || !apiBase) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const b = bucket.toLowerCase();
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\\.s3(?:\\.[a-z0-9-]+)?\\.amazonaws\\.com$`, 'i');
    if (!re.test(host)) return null;
    const raw = u.pathname.replace(/^\/+/, '');
    if (!raw) return null;
    const segments = decodeURIComponent(raw)
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg));
    return `${apiBase.replace(/\/$/, '')}/api/s3-media/${segments.join('/')}`;
  } catch {
    return null;
  }
}

function rewriteS3VirtualHostFromStorage(url) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(S3_VH_REWRITE_KEY);
    if (!raw) return null;
    const { bucket, enabled } = JSON.parse(raw);
    if (!enabled || !bucket) return null;
    const origin = backendOrigin();
    if (!origin) return null;
    return tryRewriteS3VirtualHostUrl(url, bucket, origin);
  } catch {
    return null;
  }
}

/** When DB has https://bucket.s3.region.amazonaws.com/uploads/... but the bucket is private: serve via API using REACT_APP_BACKEND_URL (no /api/settings required). */
function tryRewriteS3VirtualHostForPrivateBucket(url, apiBase) {
  if (!url || !apiBase) return null;
  const prefix = (process.env.REACT_APP_AWS_S3_PREFIX || 'uploads').replace(/^\/+|\/+$/g, '');
  try {
    const u = new URL(url);
    const host = u.hostname || '';
    if (!/^[^.]+\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/i.test(host)) return null;
    let path = u.pathname.replace(/^\/+/, '');
    const pfx = `${prefix}/`;
    if (!path.startsWith(pfx) && path !== prefix) return null;
    if (path === prefix || !path) return null;
    const segments = path
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)));
    return `${apiBase.replace(/\/$/, '')}/api/s3-media/${segments.join('/')}`;
  } catch {
    return null;
  }
}

/** True if the value looks like an image URL (excludes mistaken plain text such as a client name). */
export function isLikelyImageUrl(s) {
  if (s == null || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith('//')) return true;
  if (t.startsWith('/api/')) return true;
  if (t.startsWith('data:') || t.startsWith('blob:')) return true;
  if (/^api\//i.test(t)) return true;
  if (t.startsWith('/') && t.length > 2) return true;
  // Paths saved without a leading slash or scheme (e.g. assets/... or cdn host + path) still need to render.
  if (/\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(t) && /[/\\]/.test(t)) return true;
  return false;
}

/**
 * Resolves an image/video URL for <img src> / background.
 * - Accepts a string or { url, secure_url } (legacy object shape from older uploads).
 * - Absolute http(s) / data / blob URLs are returned as-is.
 * - Paths under /api/... are prefixed with BACKEND_URL from config (env or current origin).
 * - Tolerates missing leading slash (api/...) from older data.
 */
function toImageString(url) {
  if (url == null) return '';
  if (typeof url === 'string') return url.trim();
  if (typeof url === 'object') {
    const u = url.url ?? url.secure_url;
    if (typeof u === 'string') return u.trim();
  }
  return '';
}

export function resolveImageUrl(url) {
  let u = toImageString(url);
  if (!u) return '';

  const lower = u.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    const proxied = rewriteS3VirtualHostFromStorage(u);
    if (proxied) return proxied;
    const origin = backendOrigin();
    if (origin) {
      const viaApi = tryRewriteS3VirtualHostForPrivateBucket(u, origin);
      if (viaApi) return viaApi;
    }
  }
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('//')
  ) {
    return u;
  }

  if (!u.startsWith('/') && u.startsWith('api/')) {
    u = `/${u}`;
  }

  const origin = backendOrigin();
  if (u.startsWith('/api/') && origin) {
    return `${origin}${u}`;
  }

  return u;
}
