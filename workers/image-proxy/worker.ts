/**
 * PostalPeek Image Proxy Worker
 *
 * Sits in front of the R2 bucket at img.postalpeek.app and validates
 * HMAC-signed, time-limited URLs before serving images.
 *
 * URL formats:
 *   Signed:   /s/{token}/{expiry}/{...path}
 *   CF Image: /cdn-cgi/image/{options}/s/{token}/{expiry}/{...path}
 *   Legacy:   /{...path}  (unsigned, only allowed during migration grace period)
 */

// ─── Bot detection (same list as Pages worker) ─────────────────────
const BOT_UA_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'Slackbot',
  'TelegramBot',
  'Discordbot',
  'googlebot',
  'bingbot',
  'yandexbot',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some((bot) => ua.includes(bot.toLowerCase()));
}

// ─── Crypto helpers ────────────────────────────────────────────────

async function hmacSign(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  // URL-safe base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function verifyToken(
  secret: string,
  token: string,
  path: string,
  expiry: string,
): Promise<boolean> {
  const expected = await hmacSign(secret, `${path}:${expiry}`);
  // Constant-time comparison
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── MIME type helper ──────────────────────────────────────────────

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return map[ext || ''] || 'application/octet-stream';
}

// ─── Worker ────────────────────────────────────────────────────────

interface Env {
  IMAGES_BUCKET: R2Bucket;
  IMAGE_SIGN_SECRET: string;
  /** Set to "true" during migration to allow unsigned URLs */
  ALLOW_UNSIGNED?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // ── Handle CF Image Transformations (/cdn-cgi/image/...) ────
    // Cloudflare processes these internally before hitting the worker.
    // If the request arrives here with /cdn-cgi/, pass it through.
    if (url.pathname.startsWith('/cdn-cgi/')) {
      // Extract the real path after the CF image options
      // Format: /cdn-cgi/image/{options}/{actual-path}
      const afterOptions = url.pathname.replace(
        /^\/cdn-cgi\/image\/[^/]+\//,
        '/',
      );

      // If the inner path is signed, validate it
      if (afterOptions.startsWith('/s/')) {
        const result = parseSignedPath(afterOptions);
        if (result) {
          const valid = await verifyToken(
            env.IMAGE_SIGN_SECRET,
            result.token,
            result.objectPath,
            result.expiry,
          );
          if (!valid || isExpired(result.expiry)) {
            return new Response('Forbidden — invalid or expired token', {
              status: 403,
            });
          }
        }
      }

      // Let Cloudflare's Image Resizing handle it — fetch from R2
      const objectPath = afterOptions.replace(/^\//, '');
      return serveFromR2(env, objectPath, request);
    }

    // ── Signed URL path: /s/{token}/{expiry}/{...path} ──────────
    if (url.pathname.startsWith('/s/')) {
      const result = parseSignedPath(url.pathname);
      if (!result) {
        return new Response('Bad request — malformed signed URL', {
          status: 400,
        });
      }

      const { token, expiry, objectPath } = result;

      // Verify HMAC
      const valid = await verifyToken(
        env.IMAGE_SIGN_SECRET,
        token,
        objectPath,
        expiry,
      );
      if (!valid) {
        return new Response('Forbidden — invalid token', { status: 403 });
      }

      // Check expiry
      if (isExpired(expiry)) {
        return new Response('Gone — URL has expired', { status: 410 });
      }

      return serveFromR2(env, objectPath, request);
    }

    // ── Unsigned URL (legacy / bots) ────────────────────────────
    const objectPath = url.pathname.replace(/^\//, '');

    // Always allow bots (for OG previews / social sharing)
    if (isBot(userAgent)) {
      return serveFromR2(env, objectPath, request);
    }

    // Grace period: allow unsigned access if ALLOW_UNSIGNED=true
    if (env.ALLOW_UNSIGNED === 'true') {
      return serveFromR2(env, objectPath, request);
    }

    // Strict mode: reject unsigned URLs
    return new Response('Forbidden — signed URL required', { status: 403 });
  },
};

// ─── Helpers ───────────────────────────────────────────────────────

function parseSignedPath(
  pathname: string,
): { token: string; expiry: string; objectPath: string } | null {
  // /s/{token}/{expiry}/{...rest}
  const match = pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/(\d+)\/(.+)$/);
  if (!match) return null;
  return { token: match[1], expiry: match[2], objectPath: match[3] };
}

function isExpired(expiry: string): boolean {
  return Date.now() > parseInt(expiry, 10) * 1000;
}

async function serveFromR2(
  env: Env,
  objectPath: string,
  request: Request,
): Promise<Response> {
  const object = await env.IMAGES_BUCKET.get(objectPath);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', getMimeType(objectPath));
  headers.set('Content-Disposition', 'inline'); // Never trigger download
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent hotlinking from other domains
  const referer = request.headers.get('referer');
  if (referer) {
    const refUrl = new URL(referer);
    if (
      !refUrl.hostname.endsWith('postalpeek.app') &&
      !refUrl.hostname.includes('localhost')
    ) {
      // Allow but strip cache — hotlinked images won't be cached
      headers.set('Cache-Control', 'private, no-store');
    }
  }

  // ETag support for conditional requests
  headers.set('ETag', object.httpEtag);
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}
