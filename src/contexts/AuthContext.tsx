import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { clearSessionTokens, hydrateSession, onSessionExpired, setSessionTokens } from '@/api/client';
import { getMyProfile } from '@/api/users';
import { logout as logoutRequest, resendVerificationEmail } from '@/api/auth';
import type { AuthTokens, User } from '@/api/types';
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
  refreshUser: () => Promise<void>;
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
    });
  }, []);

  useEffect(() => {
    (async () => {
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
      } catch (e) {
        // A 401 here means even the interceptor's silent refresh attempt failed (client.ts has
        // already cleared tokens and fired sessionExpiredHandler in that case) — a genuinely
        // invalid session. Anything else (no connectivity, a timeout, a cold-starting backend)
        // is NOT a reason to sign the user out — the stored session is still perfectly valid,
        // we just couldn't confirm it right now. Stay on 'loading' rather than guessing wrong:
        // NetworkContext's offline banner explains the wait, and reloads the app once
        // connectivity returns, which re-runs this hydration with the still-valid tokens.
        const isAuthFailure = axios.isAxiosError(e) && e.response?.status === 401;
        if (isAuthFailure) {
          await clearSessionTokens();
          setStatus(onboardingSeen ? 'unauthenticated' : 'onboarding');
        }
      }
    })();
  }, []);

  const establishSession = useCallback(async (tokens: AuthTokens) => {
    await setSessionTokens(tokens);
    const profile = await applyKycBypass(await getMyProfile());
    setUser(profile);
    setStatus('authenticated');
    return profile;
  }, []);

  const establishRegisteredSession = useCallback(
    async (tokens: AuthTokens, otpToken: string) => {
      await setSessionTokens(tokens);
      updateEmailOtpToken(otpToken);
      setStatus('authenticated');
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
