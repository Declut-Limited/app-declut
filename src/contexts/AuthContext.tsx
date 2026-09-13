import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import { clearSessionTokens, hydrateSession, onSessionExpired, onTokensRefreshed, setSessionTokens } from '@/api/client';
import { getMyProfile } from '@/api/users';
import { logout as logoutRequest, resendVerificationEmail } from '@/api/auth';
import type { AuthTokens, User } from '@/api/types';
import { queryClient } from '@/lib/queryClient';
import { connectSocket, disconnectSocket, updateSocketToken } from '@/lib/socket';
import { showWarningToast } from '@/lib/toast';
import {
  clearEmailOtpToken as persistClearEmailOtpToken,
  getEmailOtpToken,
  getKycBypassed,
  getOnboardingSeen,
  setEmailOtpToken as persistEmailOtpToken,
  setKycBypassed as persistKycBypassed,
  setOnboardingSeen as persistOnboardingSeen,
} from '@/lib/secureStore';

export type SessionStatus = 'loading' | 'onboarding' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: SessionStatus;
  user: User | null;
  establishSession: (tokens: AuthTokens) => Promise<User>;
  establishRegisteredSession: (tokens: AuthTokens, otpToken: string) => Promise<void>;
  emailOtpToken: string | null;
  ensureEmailOtpToken: () => Promise<string>;
  refreshEmailOtpToken: () => Promise<string>;
  markEmailVerified: () => void;
  markKycVerified: () => void;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshUser: () => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** The app is gated by email verification and KYC — both driven directly off the user record, not a derived status. */
export function isVerified(user: User | null): boolean {
  return !!user?.emailVerified && user?.kycStatus === 'verified';
}

/** TEMPORARY — /kyc/verify-nin and /kyc/liveness-check aren't live on the backend yet. Once bypassed on this device, treat kycStatus as verified regardless of what the backend actually returns (see CLAUDE.md). */
async function applyKycBypass(profile: User): Promise<User> {
  if (profile.kycStatus === 'verified') return profile;
  const bypassed = await getKycBypassed();
  return bypassed ? { ...profile, kycStatus: 'verified' } : profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [emailOtpToken, setEmailOtpToken] = useState<string | null>(null);
  const emailOtpTokenRef = useRef<string | null>(null);

  const updateEmailOtpToken = useCallback((token: string | null) => {
    emailOtpTokenRef.current = token;
    setEmailOtpToken(token);
    // Fire-and-forget persistence, survives the app being killed mid-verification.
    if (token) persistEmailOtpToken(token).catch(() => {});
    else persistClearEmailOtpToken().catch(() => {});
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setStatus('unauthenticated');
      // Same reasoning as the manual signOut() below — every cached listing/transaction/review/
      // bank-account query is scoped to whoever was just signed out.
      queryClient.clear();
      disconnectSocket();
      showWarningToast('Session expired', 'Please sign in again to continue.');
      // Force navigation immediately regardless of which screen is currently mounted — updating
      // `status` alone only redirects if app/index.tsx happens to be the active route. A user deep
      // in (tabs)/home or a modal would otherwise be silently left on a now-signed-out screen.
      router.replace('/(auth)/sign-in');
    });
  }, []);

  // A live socket doesn't re-verify mid-connection — without this it would keep working past the
  // old access token's expiry on borrowed time instead of actually failing loudly (see
  // src/lib/socket.ts's own note). client.ts calls this every time /auth/refresh rotates the pair.
  useEffect(() => {
    onTokensRefreshed((tokens) => updateSocketToken(tokens.accessToken));
  }, []);

  const hydrate = useCallback(async () => {
    const [tokens, onboardingSeen, storedOtpToken] = await Promise.all([
      hydrateSession(),
      getOnboardingSeen(),
      getEmailOtpToken(),
    ]);
    if (storedOtpToken) {
      emailOtpTokenRef.current = storedOtpToken;
      setEmailOtpToken(storedOtpToken);
    }

    if (!tokens) {
      setStatus(onboardingSeen ? 'unauthenticated' : 'onboarding');
      return;
    }

    try {
      const profile = await applyKycBypass(await getMyProfile());
      setUser(profile);
      setStatus('authenticated');
      connectSocket(tokens.accessToken);
    } catch (e) {
      // A 401 here means the interceptor's own refresh attempt (client.ts) already exhausted its
      // retries and got a definitive rejection from the server — tokens are already cleared and
      // sessionExpiredHandler has already fired above. Anything else (no connectivity, a timeout,
      // a 5xx) is NOT a reason to sign the user out — client.ts's refresh logic treats those as
      // transient and never touches the stored session, so it's still perfectly valid, we just
      // couldn't confirm it right now. Stay on 'loading' rather than guessing wrong; the
      // online-retry effect below re-runs this once connectivity is confirmed back.
      const isAuthFailure = axios.isAxiosError(e) && e.response?.status === 401;
      if (isAuthFailure) {
        await clearSessionTokens();
        setStatus(onboardingSeen ? 'unauthenticated' : 'onboarding');
      }
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Safety net for a cold launch that starts offline (or loses connectivity mid-hydration):
  // client.ts's own refresh retries cover brief blips during normal use, but the very first
  // getMyProfile() call above has nothing to retry against if there's no connection at all yet.
  // Retry hydration itself once connectivity is confirmed back — scoped to "still stuck loading"
  // only, unlike the app-wide reload this replaced, which used to fire on every reconnect and force
  // this same network call at the least reliable moment right after reconnecting.
  useEffect(() => {
    if (status !== 'loading') return;
    return onlineManager.subscribe((isOnline) => {
      if (isOnline) hydrate();
    });
  }, [status, hydrate]);

  const establishSession = useCallback(async (tokens: AuthTokens) => {
    await setSessionTokens(tokens);
    const profile = await applyKycBypass(await getMyProfile());
    setUser(profile);
    setStatus('authenticated');
    connectSocket(tokens.accessToken);
    return profile;
  }, []);

  const establishRegisteredSession = useCallback(
    async (tokens: AuthTokens, otpToken: string) => {
      await setSessionTokens(tokens);
      updateEmailOtpToken(otpToken);
      setStatus('authenticated');
      connectSocket(tokens.accessToken);
      getMyProfile()
        .then(applyKycBypass)
        .then(setUser)
        .catch(() => {});
    },
    [updateEmailOtpToken]
  );

  const refreshEmailOtpToken = useCallback(async () => {
    const result = await resendVerificationEmail();
    updateEmailOtpToken(result.otpToken);
    return result.otpToken;
  }, [updateEmailOtpToken]);

  const ensureEmailOtpToken = useCallback(async () => {
    if (emailOtpTokenRef.current) return emailOtpTokenRef.current;
    return refreshEmailOtpToken();
  }, [refreshEmailOtpToken]);

  const markEmailVerified = useCallback(() => {
    updateEmailOtpToken(null);
    setUser((prev) => (prev ? { ...prev, emailVerified: true } : prev));
  }, [updateEmailOtpToken]);

  const markKycVerified = useCallback(() => {
    persistKycBypassed().catch(() => {});
    setUser((prev) => (prev ? { ...prev, kycStatus: 'verified' } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await applyKycBypass(await getMyProfile());
    setUser(profile);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    const tokens = await hydrateSession();
    if (tokens) {
      await logoutRequest(tokens.refreshToken).catch(() => {});
    }
    await clearSessionTokens();
    updateEmailOtpToken(null);
    setUser(null);
    setStatus('unauthenticated');
    // Every cached listing/transaction/review/bank-account query is scoped to whoever was signed
    // in — on a shared device the next sign-in must never render a stale frame of this account's
    // data before its own fetches land.
    queryClient.clear();
    disconnectSocket();
  }, [updateEmailOtpToken]);

  const completeOnboarding = useCallback(async () => {
    await persistOnboardingSeen();
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      establishSession,
      establishRegisteredSession,
      emailOtpToken,
      ensureEmailOtpToken,
      refreshEmailOtpToken,
      markEmailVerified,
      markKycVerified,
      signOut,
      completeOnboarding,
      refreshUser,
    }),
    [
      status,
      user,
      establishSession,
      establishRegisteredSession,
      emailOtpToken,
      ensureEmailOtpToken,
      refreshEmailOtpToken,
      markEmailVerified,
      markKycVerified,
      signOut,
      completeOnboarding,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
