import * as SecureStore from 'expo-secure-store';

/**
 * Access/refresh tokens are bearer credentials — expo-secure-store (OS-level
 * secure storage) only, never AsyncStorage or plain JS state (see CLAUDE.md).
 */

const ACCESS_TOKEN_KEY = 'declut.accessToken';
const REFRESH_TOKEN_KEY = 'declut.refreshToken';
const ONBOARDING_SEEN_KEY = 'declut.onboardingSeen';
const EMAIL_OTP_TOKEN_KEY = 'declut.emailOtpToken';
const KYC_BYPASSED_KEY = 'declut.kycBypassed';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export async function getOnboardingSeen(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY)) === 'true';
}

export async function setOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, 'true');
}

/**
 * The signup-verification otpToken is itself a bearer-style JWT (see CLAUDE.md),
 * so it gets the same storage treatment as access/refresh tokens. Persisting it
 * means killing the app mid-verification doesn't force an unnecessary resend —
 * the backend already handles otpToken expiry/validation on its end.
 */
export async function getEmailOtpToken(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_OTP_TOKEN_KEY);
}

export async function setEmailOtpToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(EMAIL_OTP_TOKEN_KEY, token);
}

export async function clearEmailOtpToken(): Promise<void> {
  await SecureStore.deleteItemAsync(EMAIL_OTP_TOKEN_KEY);
}

/** TEMPORARY — /kyc/verify-nin and /kyc/liveness-check aren't live yet (see CLAUDE.md). */
export async function getKycBypassed(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KYC_BYPASSED_KEY)) === 'true';
}

export async function setKycBypassed(): Promise<void> {
  await SecureStore.setItemAsync(KYC_BYPASSED_KEY, 'true');
}
