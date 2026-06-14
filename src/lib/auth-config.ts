import {
  buildEntityBuildersAuthRedirectUrl,
  getEntityBuildersAppOrFallback,
} from '@eb-packages/app-registry';
import { createEntityAuthConfig } from '@eb-packages/auth';

const postalpeekApp = getEntityBuildersAppOrFallback('postalpeek');

export const postalpeekAuthConfig = createEntityAuthConfig({
  appId: postalpeekApp.appId,
  appName: postalpeekApp.displayName,
  redirectTo: () =>
    buildEntityBuildersAuthRedirectUrl(
      postalpeekApp.appId,
      window.location.origin,
    ),
  methods: [
    { type: 'email_otp', label: 'Magic code by email' },
    {
      type: 'oauth',
      provider: 'google',
      enabled: false,
      label: 'Continue with Google',
      unavailableReason: 'provider_not_configured',
    },
    {
      type: 'oauth',
      provider: 'apple',
      enabled: false,
      label: 'Continue with Apple',
      unavailableReason: 'provider_not_configured',
    },
  ],
  copy: {
    title: 'Join PostalPeek',
    subtitle: 'Collect postcards, albums, and games with a permanent account.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    codeLabel: 'Code',
    codePlaceholder: '6-digit code',
    requestCodeLabel: 'Continue with Email',
    verifyCodeLabel: 'Verify Code',
    resendCodeLabel: "Didn't get the code? Resend",
    signOutLabel: 'Sign out',
    unavailableLabel:
      'PostalPeek account access is not configured in this environment.',
  },
  analyticsContext: {
    app: postalpeekApp.analyticsAppId,
  },
});
