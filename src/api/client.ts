import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens } from './types';
import { clearTokens, getTokens, setTokens } from '@/lib/secureStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://unconscious-juli-idowu-space-4ff4116d.koyeb.app/api';

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
  if (__DEV__) console.log(`[API] -> ${config.method?.toUpperCase()} ${config.url}`);
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

// These return 401 for a wrong/expired OTP (business logic, not an invalid access token) — must not trigger a silent token refresh + retry, or a wrong code can look like a session expiry and sign the user out mid-verification.
const REFRESH_EXEMPT_PATHS = ['/auth/refresh', '/auth/login', '/auth/verify-email', '/auth/verify-otp'];

// Registered BEFORE the dev-logging interceptor below so a 401 that's about to be silently
// refreshed-and-retried never reaches it — otherwise the logger prints a scary "401" line for
// every expired-token request even when it's transparently recovered a moment later.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isRefreshExempt = REFRESH_EXEMPT_PATHS.some((path) => config?.url?.includes(path));

    if (error.response?.status === 401 && config && !config._retried && !isRefreshExempt) {
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

// Dev-only network visibility — only ever sees a 401 here if the refresh-retry interceptor above
// couldn't recover it (no refresh token, refresh itself failed, or the path is refresh-exempt),
// so what prints is always a real, unrecovered failure worth looking at.
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) console.log(`[API] <- ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    if (__DEV__) {
      if (error.response) {
        console.error(`[API] <- ${error.response.status} ${error.config?.url}`, error.response.data);
      } else {
        console.error(`[API] no response for ${error.config?.url} — network error / timeout / unreachable host`, error.message);
      }
    }
    return Promise.reject(error);
  }
);

interface ErrorBody {
  message?: string | string[];
  error?: { message?: string | string[] };
}

export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ErrorBody | undefined;
    // Real deployed shape is { success: false, error: { message, statusCode, ... } };
    // some endpoints may still return the bare Nest default { message, statusCode, error }.
    const message = body?.error?.message ?? body?.message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
