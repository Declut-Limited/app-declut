import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EnvelopeSimpleOpen } from 'phosphor-react-native';
import { Card, OtpInput, ScreenContainer, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { verifyEmail } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { useSingleTap } from '@/hooks/useSingleTap';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailScreen() {
  const { markEmailVerified, user, ensureEmailOtpToken, refreshEmailOtpToken } = useAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const requestedOnce = useRef(false);
  const guard = useSingleTap();

  useEffect(() => {
    if (requestedOnce.current) return;
    requestedOnce.current = true;
    // Register already triggers the first send and returns its otpToken — this
    // only fetches a fresh one when we don't already hold one (app restarted
    // mid-flow, or logging back in with an unverified account; see CLAUDE.md).
    ensureEmailOtpToken()
      .then(() => setCooldown(RESEND_COOLDOWN_SECONDS))
      .catch((e) => setError(extractErrorMessage(e, 'Could not send a verification code yet.')));
  }, [ensureEmailOtpToken]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleComplete(code: string) {
    setError(null);
    setVerifying(true);
    try {
      const otpToken = await ensureEmailOtpToken();
      await verifyEmail({ otpToken, otp: code });
      markEmailVerified();
      router.replace('/(kyc)/verify-nin');
    } catch (e) {
      setError(extractErrorMessage(e, 'That code didn\'t work. Please try again.'));
      setOtp('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    try {
      await refreshEmailOtpToken();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not resend the code yet.'));
    }
  }

  return (
    <ScreenContainer>
      <StepHeader step={1} total={3} />
      <Card style={styles.card}>
        <View style={styles.avatar}>
          <EnvelopeSimpleOpen size={28} color={colors.primary} />
        </View>
        <Text style={styles.headline}>Let's verify its you</Text>
        <Text style={styles.subtext}>
          We've sent a 6-digit code to {user?.email ?? 'your email address'}. It'll auto-verify once entered.
        </Text>

        <OtpInput value={otp} onChangeText={setOtp} onComplete={handleComplete} autoFocus />

        {verifying ? <Text style={styles.helper}>Verifying…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.resendRow}>
          Didn't receive the code?{' '}
          <Text
            style={[styles.resendAction, cooldown > 0 && styles.resendActionDisabled]}
            onPress={guard(handleResend)}
          >
            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
          </Text>
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  helper: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  resendRow: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  resendAction: {
    fontFamily: fontFamily.semibold,
    color: colors.primary,
  },
  resendActionDisabled: {
    color: colors.gray400,
  },
});
