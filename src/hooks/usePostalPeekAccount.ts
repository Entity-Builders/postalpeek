import {
  useSupabaseAccountAccess,
  type SupabaseAuthAccessClient,
} from '@eb-packages/auth';
import { useMemo } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { analytics } from '../lib/analytics';
import { postalpeekAuthConfig } from '../lib/auth-config';
import { preparePostalPeekEmailOtpToken } from '../lib/localOtp';

export type PostalPeekAuthSurface = 'auth_gate' | 'feed_cta';

const POSTALPEEK_AUTH_MESSAGES = {
  supabaseNotConfigured: 'PostalPeek account access is not configured here.',
  missingEmail: 'Enter an email to continue.',
  missingCredentials: 'Enter the email and code.',
  codeSent: 'Check your inbox for the 6-digit code.',
  connected: 'Account connected.',
  guestReady: '',
  oauthStarted: 'Continue with the provider to finish signing in.',
  oauthFailed: 'We could not finish sign-in. Try again.',
  oauthLinkedIdentityError:
    'That identity is already connected to another account. Use email code or another account.',
  authMethodUnavailable: 'That sign-in method is not available for PostalPeek.',
};

export const usePostalPeekAccount = (
  surface: PostalPeekAuthSurface = 'auth_gate',
) => {
  const authConfig = useMemo(
    () => ({
      ...postalpeekAuthConfig,
      analyticsContext: {
        ...postalpeekAuthConfig.analyticsContext,
        surface,
      },
    }),
    [surface],
  );

  const account = useSupabaseAccountAccess({
    client: supabase as unknown as SupabaseAuthAccessClient,
    isConfigured: true,
    authConfig,
    analytics,
    messages: POSTALPEEK_AUTH_MESSAGES,
    prepareEmailOtpToken: preparePostalPeekEmailOtpToken,
  });

  return {
    ...account,
    authEntryConfig: authConfig,
  };
};

export type PostalPeekAccount = ReturnType<typeof usePostalPeekAccount>;
