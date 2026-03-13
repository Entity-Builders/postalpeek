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

/**
 * Initialize PostHog. Call once from App.tsx.
 */
export function initAnalytics() {
  analytics.init({
    apiKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY || '',
    apiHost:
      import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: true,
    disableSessionRecording: false,
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
