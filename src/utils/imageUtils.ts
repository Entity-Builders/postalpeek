/**
 * Image optimization utilities for PostalPeek.
 *
 * Handles rewriting legacy R2 dev URLs to the custom domain
 * (img.postalpeek.app), generates HMAC-signed URLs with expiration,
 * and leverages Cloudflare Image Transformations for on-the-fly resize,
 * format conversion (AVIF/WebP), and quality control.
 *
 * Signed URL format:
 *   https://img.postalpeek.app/s/{token}/{expiry}/{path}
 *
 * CF Image Transformations URL format:
 *   https://img.postalpeek.app/cdn-cgi/image/{options}/s/{token}/{expiry}/{path}
 */

/** The old R2 public dev URL (no CDN caching, generic TLS) */
const LEGACY_R2_HOST = 'pub-2fd871195f814f7083d91fe7dbbdb4b2.r2.dev';

/** The new custom domain connected to the same R2 bucket */
const CDN_HOST = 'img.postalpeek.app';
const CDN_ORIGIN = `https://${CDN_HOST}`;

/**
 * Signing key loaded from env. Falls back to empty string which disables
 * signing (useful during migration period when ALLOW_UNSIGNED=true on Worker).
 */
const SIGN_KEY = import.meta.env.VITE_IMAGE_SIGN_KEY || '';

/** Default signed URL TTL: 2 hours (in seconds) */
const DEFAULT_TTL = 2 * 60 * 60;

// ─── HMAC Signing (Web Crypto API) ──────────────────────────────

let _cryptoKey: CryptoKey | null = null;

async function getCryptoKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey;
  const encoder = new TextEncoder();
  _cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SIGN_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return _cryptoKey;
}

/**
 * Generate an HMAC-SHA256 signature for a path + expiry pair.
 * Returns URL-safe base64.
 */
async function hmacSign(message: string): Promise<string> {
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign a normalized object path with an expiry timestamp.
 * Returns the full signed path: /s/{token}/{expiry}/{objectPath}
 */
async function signPath(
  objectPath: string,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await hmacSign(`${objectPath}:${expiry}`);
  return `/s/${token}/${expiry}/${objectPath}`;
}

// ─── URL Cache ──────────────────────────────────────────────────
// Avoid re-signing the same path during the same session.
// Keys: objectPath → { signedPath, expiresAt }

const signedCache = new Map<string, { signedPath: string; expiresAt: number }>();

function getCachedSignedPath(objectPath: string): string | null {
  const cached = signedCache.get(objectPath);
  if (!cached) return null;
  // Refresh if less than 10 minutes before expiry
  if (Date.now() / 1000 > cached.expiresAt - 600) {
    signedCache.delete(objectPath);
    return null;
  }
  return cached.signedPath;
}

async function getSignedPath(objectPath: string): Promise<string> {
  const cached = getCachedSignedPath(objectPath);
  if (cached) return cached;

  const signed = await signPath(objectPath);
  const expiry = Math.floor(Date.now() / 1000) + DEFAULT_TTL;
  signedCache.set(objectPath, { signedPath: signed, expiresAt: expiry });
  return signed;
}

// ─── Pre-computed signed URL store ──────────────────────────────
// Since signing is async, we pre-sign URLs and store them as sync-accessible.
// Components call `preSignUrls()` on data fetch, then use sync getters.

const preSignedStore = new Map<string, string>();

/**
 * Pre-sign a batch of image URLs. Call this after fetching postcard data.
 * After this resolves, `cdnUrl()` and `cdnImage()` will return signed URLs.
 */
export async function preSignUrls(urls: string[]): Promise<void> {
  if (!SIGN_KEY) return; // Signing disabled

  const needsSigning = urls
    .filter(Boolean)
    .map((u) => u.replace(`https://${LEGACY_R2_HOST}`, '').replace(`https://${CDN_HOST}`, '').replace(/^\//, ''))
    .filter((path) => !preSignedStore.has(path));

  await Promise.all(
    needsSigning.map(async (objectPath) => {
      const signed = await getSignedPath(objectPath);
      preSignedStore.set(objectPath, signed);
    }),
  );
}

/**
 * Get the (potentially signed) path for an object.
 * If signing is enabled and the URL has been pre-signed, returns the signed path.
 * Otherwise returns the original path (for migration grace period).
 */
function resolveObjectPath(objectPath: string): string {
  if (!SIGN_KEY) return objectPath;
  return preSignedStore.get(objectPath) || objectPath;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Rewrite a legacy `pub-xxx.r2.dev` URL to the custom CDN domain,
 * with signed path if signing is enabled.
 */
export function cdnUrl(url: string): string {
  if (!url) return url;
  const normalized = url.replace(LEGACY_R2_HOST, CDN_HOST);

  // Only sign URLs on our CDN domain
  if (!normalized.includes(CDN_HOST)) return normalized;

  const objectPath = normalized.replace(CDN_ORIGIN, '').replace(/^\//, '');
  const signedPath = resolveObjectPath(objectPath);

  return `${CDN_ORIGIN}/${signedPath}`;
}

// ─── Cloudflare Image Transformations ────────────────────────

interface TransformOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Image quality 1-100 (default: 80) */
  quality?: number;
  /** Fit mode: cover (crop), contain, scale-down, etc. */
  fit?: 'cover' | 'contain' | 'scale-down' | 'crop' | 'pad';
  /**
   * Output format. 'auto' lets Cloudflare pick the best the browser supports
   * (AVIF > WebP > original). This is almost always the right choice.
   */
  format?: 'auto' | 'avif' | 'webp' | 'json';
}

/**
 * Build a Cloudflare Image Transformation URL with signed path.
 *
 * @example
 *   cdnImage('https://img.postalpeek.app/illustrations/abc.webp', { width: 480 })
 *   // → 'https://img.postalpeek.app/cdn-cgi/image/width=480,format=auto,quality=80,fit=cover/s/{token}/{expiry}/illustrations/abc.webp'
 */
export function cdnImage(url: string, opts: TransformOptions = {}): string {
  if (!url) return url;

  // First normalize to CDN domain
  const normalized = url.replace(LEGACY_R2_HOST, CDN_HOST);

  // Only transform URLs on our CDN domain
  if (!normalized.includes(CDN_HOST)) return normalized;

  // Extract the path after the domain
  const rawPath = normalized.replace(CDN_ORIGIN, '').replace(/^\//, '');

  // Don't double-transform
  if (rawPath.startsWith('cdn-cgi/')) return normalized;

  // Resolve to signed path (or original if signing is off)
  const signedPath = resolveObjectPath(rawPath);

  // Build transform options string
  const params: string[] = [];
  if (opts.width) params.push(`width=${opts.width}`);
  if (opts.height) params.push(`height=${opts.height}`);
  params.push(`format=${opts.format ?? 'auto'}`);
  params.push(`quality=${opts.quality ?? 80}`);
  params.push(`fit=${opts.fit ?? 'cover'}`);

  return `${CDN_ORIGIN}/cdn-cgi/image/${params.join(',')}/${signedPath}`;
}

/**
 * Generate a srcSet string for responsive `<img>` elements.
 *
 * @example
 *   cdnSrcSet(url, [480, 768, 1024])
 *   // → 'https://…/cdn-cgi/image/width=480,…/s/{token}/{expiry}/path.webp 480w, …'
 */
export function cdnSrcSet(url: string, widths: number[]): string {
  if (!url) return '';
  return widths
    .map((w) => `${cdnImage(url, { width: w })} ${w}w`)
    .join(', ');
}

/** Standard responsive breakpoints */
export const WIDTHS = {
  /** Background blur — only needs a tiny image */
  blur: 64,
  /** Thumbnails (welcome, auth gate stacked cards) */
  thumb: 280,
  /** Mobile illustration */
  mobile: 480,
  /** Tablet illustration */
  tablet: 768,
  /** Desktop illustration */
  desktop: 1024,
} as const;
