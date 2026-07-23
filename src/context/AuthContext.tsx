import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearSessionTokens, hydrateSession, onSessionExpired, setSessionTokens } from '@/api/client';
import { getMyProfile } from '@/api/users';
import { logout as logoutRequest, resendVerificationEmail } from '@/api/auth';
import type { AuthTokens, User } from '@/api/types';
import { getOnboardingSeen, setOnboardingSeen as persistOnboardingSeen } from '@/lib/secureStore';

export type SessionStatus =
  | 'loading'
  | 'onboarding'
  | 'unauthenticated'
  | 'needs-email-verification'
  | 'needs-kyc'
  | 'authenticated';

interface AuthContextValue {
  status: SessionStatus;
  user: User | null;
  /**
   * Called after register/login/google with the fresh token pair; fetches the
   * profile and updates status. Register also returns a signup-verification
   * otpToken (see CLAUDE.md) — pass it through so verify-email doesn't need
   * a redundant resend right after signup.
   */
  establishSession: (tokens: AuthTokens) => Promise<void>;
  /**
   * Register-specific: a fresh registration is deterministically
   * needs-email-verification (that's the whole point of the mandatory
   * chain), so this sets status directly instead of depending on /users/me.
   * A /users/me hiccup right after signup must never make a successful
   * registration look like a failure — it just fetches the profile
   * best-effort in the background.
   */
  establishRegisteredSession: (tokens: AuthTokens, otpToken: string) => Promise<void>;
  /** Current otpToken for /auth/verify-email, if one is held. */
  emailOtpToken: string | null;
  /** Returns the held otpToken, or fetches a fresh one via resend-verification-email if none is held yet (e.g. app restarted mid-flow, or logging back in unverified). */
  ensureEmailOtpToken: () => Promise<string>;
  /** Always fetches a fresh otpToken — used by the screen's explicit "Resend" action. */
  refreshEmailOtpToken: () => Promise<string>;
  /** Called once /auth/verify-email succeeds, to move status from needs-email-verification to needs-kyc. */
  markEmailVerified: () => void;
  /** Called once /kyc/verify returns a verified status, to move status to authenticated. */
  markKycVerified: () => void;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function statusForUser(user: User): SessionStatus {
  if (!user.emailVerified) return 'needs-email-verification';
  if (user.kycStatus !== 'verified') return 'needs-kyc';
  return 'authenticated';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [emailOtpToken, setEmailOtpToken] = useState<string | null>(null);
  const emailOtpTokenRef = useRef<string | null>(null);

  const updateEmailOtpToken = useCallback((token: string | null) => {
    emailOtpTokenRef.current = token;
    setEmailOtpToken(token);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  useEffect(() => {
    (async () => {
      const [tokens, onboardingSeen] = await Promise.all([hydrateSession(), getOnboardingSeen()]);

      if (!tokens) {
        setStatus(onboardingSeen ? 'unauthenticated' : 'onboarding');
        return;
      }

      try {
        const profile = await getMyProfile();
        setUser(profile);
        setStatus(statusForUser(profile));
      } catch {
        await clearSessionTokens();
        setStatus(onboardingSeen ? 'unauthenticated' : 'onboarding');
      }
    })();
  }, []);

  const establishSession = useCallback(async (tokens: AuthTokens) => {
    await setSessionTokens(tokens);
    const profile = await getMyProfile();
    setUser(profile);
    setStatus(statusForUser(profile));
  }, []);

  const establishRegisteredSession = useCallback(
    async (tokens: AuthTokens, otpToken: string) => {
      await setSessionTokens(tokens);
      updateEmailOtpToken(otpToken);
      setStatus('needs-email-verification');
      getMyProfile()
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
    setStatus('needs-kyc');
  }, [updateEmailOtpToken]);

  const markKycVerified = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, kycStatus: 'verified' } : prev));
    setStatus('authenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await getMyProfile();
    setUser(profile);
    setStatus(statusForUser(profile));
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
