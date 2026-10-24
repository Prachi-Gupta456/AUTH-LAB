// Maps backend/provider error codes to messages a human can read
const MESSAGES = {
  access_denied: 'Sign-in was cancelled.',
  OAUTH_STATE_INVALID: 'Sign-in session expired or was invalid. Please try again.',
  OAUTH_PROVIDER_UNKNOWN: 'This sign-in provider is not available.',
  OAUTH_EXCHANGE_FAILED: 'The provider could not complete sign-in. Please try again.',
  OAUTH_PROFILE_FAILED: 'We could not read your profile from the provider.',
  OAUTH_EMAIL_UNVERIFIED: 'Your provider account has no verified email address.',
  OAUTH_CONFLICT: 'Account conflict. Please try again.',
  OAUTH_SESSION_FAILED: 'Sign-in could not be completed. Please try again.',
};

export const oauthErrorMessage = (code) =>
  MESSAGES[code] || 'Sign-in failed. Please try again.';