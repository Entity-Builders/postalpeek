import { Analytics, PostHogProvider } from '@entity-builders/analytics';

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

let appOpenedTracked = false;

function postalPeekGlobalProperties() {
  return {
    app: 'postalpeek',
    platform: 'web',
    environment: import.meta.env.PROD ? 'production' : 'development',
  };
}

export function registerAnalyticsContext() {
  analytics.setGlobalProperties(postalPeekGlobalProperties());
}

export function resetAnalyticsIdentity() {
  analytics.reset();
  registerAnalyticsContext();
}

/**
 * Initialize PostHog. Call once from App.tsx.
 */
export function initAnalytics() {
  analytics.init({
    apiKey: POSTHOG_KEY,
    apiHost: POSTHOG_HOST,
    disabled: import.meta.env.DEV,
    autocapture: true,
    disableSessionRecording: false,
  });

  // Tag every event with app context so we can filter by app in PostHog dashboard
  registerAnalyticsContext();

  if (!appOpenedTracked) {
    appOpenedTracked = true;
    analytics.track('app_opened', {
      route: window.location.pathname,
    });
  }

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
