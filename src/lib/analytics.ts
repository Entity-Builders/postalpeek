import { Analytics, PostHogProvider } from '@eb-packages/analytics';

/**
 * Shared analytics singleton for PostalPeek.
 * Import this anywhere you need to track events or errors.
 *
 * Usage:
 *   import { analytics } from '../lib/analytics';
 *   analytics.track('postcard_viewed', { postcard_id: '...' });
 *   analytics.captureError(error, { context: 'feed_load' });
 */
export const analytics = new Analytics(new PostHogProvider());

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ||
  import.meta.env.VITE_PUBLIC_POSTHOG_KEY ||
  '';
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ||
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
  'https://us.i.posthog.com';

/**
 * Initialize PostHog. Call once from App.tsx.
 */
export function initAnalytics() {
  analytics.init({
    apiKey: POSTHOG_KEY,
    apiHost: POSTHOG_HOST,
    autocapture: true,
    disableSessionRecording: false,
  });

  // Tag every event with app context so we can filter by app in PostHog dashboard
  analytics.setGlobalProperties({
    app: 'postalpeek',
    platform: 'web',
    environment: POSTHOG_KEY ? 'production' : 'development',
  });

  // Global error handlers for non-React errors
  window.onerror = (message, source, lineno, colno, error) => {
    analytics.captureError(error || new Error(String(message)), {
      source,
      lineno,
      colno,
      handler: 'window.onerror',
    });
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    analytics.captureError(event.reason, {
      handler: 'unhandledrejection',
    });
  };
}
