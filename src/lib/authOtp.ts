export const POSTALPEEK_AUTH_APP_ID = 'postalpeek';

export function createPostalPeekOtpInput(email: string) {
  return {
    email,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        app_name: POSTALPEEK_AUTH_APP_ID,
      },
    },
  };
}
