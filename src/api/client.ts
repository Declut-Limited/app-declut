import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens } from './types';
import { clearTokens, getTokens, setTokens } from '@/lib/secureStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// In-memory mirror of the secure-store token pair. Every request reads from
// here (sync) rather than awaiting secure-store on the hot path; hydrateSession()
// fills it once at boot and setSessionTokens/clearSessionTokens keep it in sync.
let currentTokens: AuthTokens | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export async function hydrateSession(): Promise<AuthTokens | null> {
  currentTokens = await getTokens();
  return currentTokens;
}

export async function setSessionTokens(tokens: AuthTokens): Promise<void> {
  currentTokens = tokens;
  await setTokens(tokens);
}

export async function clearSessionTokens(): Promise<void> {
  currentTokens = null;
  await clearTokens();
}

export function getAccessToken(): string | null {
  return currentTokens?.accessToken ?? null;
}

/** AuthProvider registers this to force a sign-out when the refresh token is itself rejected. */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (currentTokens?.accessToken && !config.headers?.['Authorization']) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${currentTokens.accessToken}`;
  }
  return config;
});

// Concurrent 401s during an in-flight refresh all await the same promise
// instead of each firing their own /auth/refresh call.
let refreshInFlight: Promise<AuthTokens | null> | null = null;

async function refreshTokens(): Promise<AuthTokens | null> {
  if (!currentTokens?.refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<{ data: AuthTokens }>(`${BASE_URL}/auth/refresh`, {
        refreshToken: currentTokens.refreshToken,
      })
      .then(async (res) => {
        const tokens = res.data.data;
        await setSessionTokens(tokens);
        return tokens;
      })
      .catch(async () => {
        await clearSessionTokens();
        sessionExpiredHandler?.();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = config?.url?.includes('/auth/refresh') || config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      const refreshed = await refreshTokens();
      if (refreshed) {
        config.headers = config.headers ?? {};
        config.headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
        return apiClient(config);
      }
    }

    return Promise.reject(error);
  }
);

export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(body?.message)) return body.message.join('\n');
    if (typeof body?.message === 'string') return body.message;
  }
  return fallback;
}
