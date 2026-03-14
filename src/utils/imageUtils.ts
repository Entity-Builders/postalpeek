/**
 * Image optimization utilities for PostalPeek.
 *
 * Handles rewriting legacy R2 dev URLs to the custom domain
 * (img.postalpeek.app) so images are served through Cloudflare's CDN
 * with proper caching, and provides responsive sizing helpers.
 */

/** The old R2 public dev URL (no CDN caching, generic TLS) */
const LEGACY_R2_HOST = 'pub-2fd871195f814f7083d91fe7dbbdb4b2.r2.dev';

/** The new custom domain connected to the same R2 bucket */
const CDN_HOST = 'img.postalpeek.app';

/**
 * Rewrite a legacy `pub-xxx.r2.dev` URL to the custom CDN domain.
 * If the URL is already on the custom domain or doesn't match the
 * legacy host, it's returned as-is.
 */
export function cdnUrl(url: string): string {
  if (!url) return url;
  return url.replace(LEGACY_R2_HOST, CDN_HOST);
}

/**
 * Standard responsive breakpoints for PostalPeek illustrations.
 * Used to build srcSet / sizes attributes for <img> elements.
 */
export const IMAGE_SIZES = {
  /** Mobile screens ≤480px */
  mobile: 480,
  /** Tablet screens ≤768px */
  tablet: 768,
  /** Desktop 1x */
  desktop: 1024,
} as const;
