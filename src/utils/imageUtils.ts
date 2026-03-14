/**
 * Image optimization utilities for PostalPeek.
 *
 * Handles rewriting legacy R2 dev URLs to the custom domain
 * (img.postalpeek.app) and leverages Cloudflare Image Transformations
 * for on-the-fly resize, format conversion (AVIF/WebP), and quality control.
 *
 * CF Image Transformations URL format:
 *   https://img.postalpeek.app/cdn-cgi/image/{options}/{path}
 */

/** The old R2 public dev URL (no CDN caching, generic TLS) */
const LEGACY_R2_HOST = 'pub-2fd871195f814f7083d91fe7dbbdb4b2.r2.dev';

/** The new custom domain connected to the same R2 bucket */
const CDN_HOST = 'img.postalpeek.app';
const CDN_ORIGIN = `https://${CDN_HOST}`;

/**
 * Rewrite a legacy `pub-xxx.r2.dev` URL to the custom CDN domain.
 * If the URL is already on the custom domain or doesn't match the
 * legacy host, it's returned as-is.
 */
export function cdnUrl(url: string): string {
  if (!url) return url;
  return url.replace(LEGACY_R2_HOST, CDN_HOST);
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
 * Build a Cloudflare Image Transformation URL.
 *
 * Takes any image URL hosted on our CDN domain and returns a `/cdn-cgi/image/`
 * URL that triggers on-the-fly resize + format conversion at the edge.
 *
 * @example
 *   cdnImage('https://img.postalpeek.app/illustrations/abc.webp', { width: 480 })
 *   // → 'https://img.postalpeek.app/cdn-cgi/image/width=480,format=auto,quality=80,fit=cover/illustrations/abc.webp'
 */
export function cdnImage(url: string, opts: TransformOptions = {}): string {
  if (!url) return url;

  // First normalize to CDN domain
  const normalized = cdnUrl(url);

  // Only transform URLs on our CDN domain
  if (!normalized.includes(CDN_HOST)) return normalized;

  // Extract the path after the domain
  const path = normalized.replace(CDN_ORIGIN, '').replace(/^\//, '');

  // Don't double-transform
  if (path.startsWith('cdn-cgi/')) return normalized;

  // Build transform options string
  const params: string[] = [];
  if (opts.width) params.push(`width=${opts.width}`);
  if (opts.height) params.push(`height=${opts.height}`);
  params.push(`format=${opts.format ?? 'auto'}`);
  params.push(`quality=${opts.quality ?? 80}`);
  params.push(`fit=${opts.fit ?? 'cover'}`);

  return `${CDN_ORIGIN}/cdn-cgi/image/${params.join(',')}/${path}`;
}

/**
 * Generate a srcSet string for responsive `<img>` elements.
 *
 * @example
 *   cdnSrcSet(url, [480, 768, 1024])
 *   // → 'https://…/cdn-cgi/image/width=480,…/path.webp 480w, https://…/width=768,…/path.webp 768w, …'
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
