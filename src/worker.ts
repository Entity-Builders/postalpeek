import { createClient } from '@supabase/supabase-js';

/**
 * Cloudflare Worker that intercepts requests from social media crawlers
 * and injects dynamic Open Graph meta tags for individual postcard URLs.
 *
 * For normal users, it serves the SPA as-is via the asset handler.
 */

// Bot User-Agent patterns that need OG tags
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
      // Serve the SPA normally via Cloudflare Pages assets
      return env.ASSETS.fetch(request);
    }

    // It's a bot requesting a postcard URL — inject OG tags
    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        // No Supabase config — serve with default OG tags
        return env.ASSETS.fetch(request);
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // The hash is the last segment (e.g., /QywJ9rK or /japan/QywJ9rK)
      const hash = segments[segments.length - 1];

      // Use the RPC to find the postcard by hash prefix
      // For now, we'll do a simple query using the hash decode logic
      const { decodeHashToUuidPrefix: decode } = await import(
        '@eb-packages/logic/src/hash'
      );
      const prefix = decode(hash);

      let postcard = null;

      if (prefix) {
        const minUuid = `${prefix}-0000-0000-0000-000000000000`;
        const maxUuid = `${prefix}-ffff-ffff-ffff-ffffffffffff`;

        const { data } = await supabase
          .from('postalpeek_postcards')
          .select('id, illustration_url, category, description, city, country')
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .limit(1)
          .single();

        postcard = data;
      }

      // Get the base HTML from assets
      const assetResponse = await env.ASSETS.fetch(
        new Request(new URL('/', url.origin), request),
      );
      let html = await assetResponse.text();

      if (postcard) {
        const title = `${postcard.category} — ${postcard.city}, ${postcard.country} | PostalPeek`;
        const description = postcard.description;
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
      // Fallback to normal SPA
      return env.ASSETS.fetch(request);
    }
  },
};
