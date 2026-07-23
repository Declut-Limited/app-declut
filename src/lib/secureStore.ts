import * as SecureStore from 'expo-secure-store';

/**
 * Access/refresh tokens are bearer credentials — expo-secure-store (OS-level
 * secure storage) only, never AsyncStorage or plain JS state (see CLAUDE.md).
 */

const ACCESS_TOKEN_KEY = 'declut.accessToken';
const REFRESH_TOKEN_KEY = 'declut.refreshToken';
const ONBOARDING_SEEN_KEY = 'declut.onboardingSeen';

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
