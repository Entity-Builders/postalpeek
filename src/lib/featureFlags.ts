/**
 * Centralized PostHog feature flag keys for PostalPeek.
 *
 * Usage:
 *   import { FeatureFlags } from '../lib/featureFlags';
 *   analytics.getFeatureFlag(FeatureFlags.SMART_SEARCH);
 */
export const FeatureFlags = {
  /** AI-powered smart search vs classic typeahead in collection */
  SMART_SEARCH: 'postalpeek_smart_search',
  /** Daily pack card reveal animation mode */
  DAILY_PACK_REVEAL_MODE: 'daily-pack-reveal-mode',
  /** Enable/disable the daily envelope (sobre diario) feature entirely */
  DAILY_PACK: 'postalpeek_daily_pack',
} as const;

export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];
