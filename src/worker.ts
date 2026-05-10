import { decodeHashToUuidPrefix } from '@eb-packages/logic/src/hash';

/**
 * Cloudflare Worker that intercepts requests from social media crawlers
 * and injects dynamic Open Graph meta tags for individual postcard URLs.
 *
 * For normal users, it serves the SPA as-is via the asset handler.
 */

// ─── Bot detection ──────────────────────────────────────────────
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

/** Extract text from a potentially bilingual JSONB field (returns es first, then en, then raw string). */
function extractText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    // Could be a JSON string from PostgREST — try parsing
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed.es || parsed.en || '';
      }
    } catch { /* not JSON, use as-is */ }
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return (value as Record<string, string>).es || (value as Record<string, string>).en || '';
  }
  return String(value);
}

// ─── Supabase REST helpers (avoids bundling full SDK) ───────────

/** Generic PostgREST fetch */
async function supabaseGet(
  supabaseUrl: string,
  supabaseKey: string,
  path: string,
): Promise<Record<string, string>[] | null> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, string>[];
}

/**
 * Resolve a share hash to postcard data.
 * Share links encode a `postalpeek_shares.id`, not the postcard ID.
 * 1. Look up the share record to get `postcard_id`
 * 2. Fetch the actual postcard by that ID
 * 3. Fallback: check if the hash maps directly to a postcard (legacy/admin links)
 */
async function queryPostcard(
  supabaseUrl: string,
  supabaseKey: string,
  minUuid: string,
  maxUuid: string,
): Promise<Record<string, string> | null> {
  // Step 1: Check postalpeek_shares for a matching share record
  const shares = await supabaseGet(
    supabaseUrl,
    supabaseKey,
    `/rest/v1/shares?select=postcard_id&id=gte.${minUuid}&id=lte.${maxUuid}&limit=1`,
  );

  if (shares && shares.length > 0 && shares[0].postcard_id) {
    // Step 2: Fetch the actual postcard by its real ID
    const postcards = await supabaseGet(
      supabaseUrl,
      supabaseKey,
      `/rest/v1/postcards?select=id,illustration_url,category,description,city,country&id=eq.${shares[0].postcard_id}&limit=1`,
    );
    if (postcards && postcards.length > 0) return postcards[0];
  }

  // Fallback: check if the hash maps directly to a postcard (legacy/admin links)
  const directMatch = await supabaseGet(
    supabaseUrl,
    supabaseKey,
    `/rest/v1/postcards?select=id,illustration_url,category,description,city,country&id=gte.${minUuid}&id=lte.${maxUuid}&limit=1`,
  );
  return directMatch && directMatch.length > 0 ? directMatch[0] : null;
}

// ─── Worker ─────────────────────────────────────────────────────

interface Env {
  ASSETS: { fetch: typeof fetch };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Only intercept bot requests for postcard URLs (not static assets)
    const segments = url.pathname.split('/').filter(Boolean);
    const hasPostcardHash = segments.length >= 1 && !segments[0].includes('.');

    if (!isBot(userAgent) || !hasPostcardHash) {
      // Try to serve the static asset first
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) return assetRes;
      // SPA fallback: serve index.html for unknown paths (client-side routing)
      return env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
    }

    // It's a bot requesting a postcard URL — inject OG tags
    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;



      if (!supabaseUrl || !supabaseKey) {
        console.warn('[Worker] Missing SUPABASE_URL or SUPABASE_ANON_KEY — serving default OG');
        return env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
      }

      // The hash is the last segment (e.g., /QywJ9rK or /japan/QywJ9rK)
      const hash = segments[segments.length - 1];
      const prefix = decodeHashToUuidPrefix(hash);


      let postcard: Record<string, string> | null = null;

      if (prefix) {
        const minUuid = `${prefix}-0000-0000-0000-000000000000`;
        const maxUuid = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
        postcard = await queryPostcard(supabaseUrl, supabaseKey, minUuid, maxUuid);

      }

      // Get the base HTML from assets
      const assetResponse = await env.ASSETS.fetch(
        new Request(new URL('/', url.origin), request),
      );
      let html = await assetResponse.text();


      if (postcard) {
        const title = `${extractText(postcard.category)} — ${postcard.city}, ${postcard.country} | PostalPeek`;
        const description = extractText(postcard.description);
        const image = postcard.illustration_url
          ? postcard.illustration_url.replace(
              'pub-2fd871195f814f7083d91fe7dbbdb4b2.r2.dev',
              'img.postalpeek.app',
            )
          : '';
        const pageUrl = url.href;

        // Replace placeholder tokens with actual values
        html = html
          .replace(
            '<title>PostalPeek — The World, Reimagined</title>',
            `<title>${title}</title>`,
          )
          .replaceAll('__OG_IMAGE__', image)
          .replaceAll('__OG_URL__', pageUrl)
          .replace(
            'content="PostalPeek — The World, Reimagined"',
            `content="${title}"`,
          )
          .replace(
            'content="AI-generated watercolor postcards from streets around the globe. A digital wanderer\'s sketchbook."',
            `content="${description}"`,
          );
      } else {
        // No postcard found — just clean up placeholders
        html = html
          .replaceAll('__OG_IMAGE__', '')
          .replaceAll('__OG_URL__', url.href);
      }

      return new Response(html, {
        headers: {
          ...Object.fromEntries(assetResponse.headers.entries()),
          'content-type': 'text/html;charset=UTF-8',
        },
      });
    } catch (error) {
      console.error('[Worker] OG injection error:', error);
      // Fallback to normal SPA (serve index.html)
      return env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
    }
  },
};
