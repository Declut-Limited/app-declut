import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheetCard, OtpInput, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { verifyEmail } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { useSingleTap } from '@/hooks/useSingleTap';
import { showErrorToast, showSuccessToast } from '@/lib/toast';

const RESEND_COOLDOWN_SECONDS = 2 * 60;

function formatCooldown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function VerifyEmailSheet() {
  const { markEmailVerified, user, ensureEmailOtpToken, refreshEmailOtpToken } = useAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const requestedOnce = useRef(false);
  const guard = useSingleTap();

  useEffect(() => {
    if (requestedOnce.current) return;
    requestedOnce.current = true;
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
    } catch (e) {
      setError(extractErrorMessage(e, 'That code didn\'t work. Please try again.'));
      setOtp('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await refreshEmailOtpToken();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showSuccessToast('Code resent', `Check ${user?.email ?? 'your email'} for the new code.`);
    } catch (e) {
      const message = extractErrorMessage(e, 'Could not resend the code yet.');
      setError(message);
      showErrorToast('Could not resend code', message);
    } finally {
      setResending(false);
    }
  }

  return (
    <BottomSheetCard>
      <StepHeader step={1} total={3} />
      <Text style={styles.headline}>Let's verify its you</Text>
      <Text style={styles.subtext}>
        We've sent a 6-digit code to {user?.email ?? 'your email address'}. It'll auto-verify once entered.
      </Text>

      <OtpInput value={otp} onChangeText={setOtp} onComplete={handleComplete} autoFocus />

      {verifying ? <Text style={styles.helper}>Verifying…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.resendLabel}>Didn't receive the code?</Text>
      <Pressable
        style={[styles.resendPill, (cooldown > 0 || resending) && styles.resendPillDisabled]}
        onPress={guard(handleResend)}
        disabled={cooldown > 0 || resending}
      >
        {resending ? (
          <ActivityIndicator size="small" color={colors.gray900} />
        ) : (
          <Text style={[styles.resendPillLabel, cooldown > 0 && styles.resendPillLabelDisabled]}>
            {cooldown > 0 ? formatCooldown(cooldown) : 'Resend'}
          </Text>
        )}
      </Pressable>
    </BottomSheetCard>
  );
}

const styles = StyleSheet.create({
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
    textAlign: 'center',
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  resendLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: -spacing.sm,
  },
  resendPill: {
    alignSelf: 'center',
    backgroundColor: colors.gray100,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
  },
  resendPillDisabled: {
    opacity: 0.6,
  },
  resendPillLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  resendPillLabelDisabled: {
    color: colors.gray400,
  },
});
