import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard, Button, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { livenessCheck } from '@/api/kyc';
import { extractErrorMessage } from '@/api/client';
import { showErrorToast, showWarningToast } from '@/lib/toast';

export function SelfieCheckSheet() {
  const { markKycVerified } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'pending' | 'rejected' | null>(null);
  const inFlight = useRef(false);

  async function handleStartCheck() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          setError('Camera access is required to complete the liveness check.');
          return;
        }
      }
      const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        setError('Could not capture a photo. Please try again.');
        return;
      }

      const response = await livenessCheck({ selfieImageBase64: photo.base64 });

      if (response.kycStatus === 'verified') {
        markKycVerified();
        router.replace('/');
      } else if (response.kycStatus === 'pending') {
        setResult('pending');
        showWarningToast('Still checking', 'This is taking longer than usual.');
      } else {
        setResult('rejected');
        showErrorToast('Verification didn\'t pass', 'Please try again with better lighting.');
      }
    } catch (e) {
      const message = extractErrorMessage(e, 'Verification failed. Please try again.');
      setError(message);
      showErrorToast('Verification failed', message);
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <BottomSheetCard>
      <StepHeader step={3} total={3} />
      <Text style={styles.headline}>Let's verify its you</Text>

      <View style={styles.previewWrapper}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.previewCircle} facing="front" />
        ) : (
          <View style={[styles.previewCircle, styles.previewPlaceholder]}>
            <Icons.CameraIcon size={28} color={colors.gray400} />
          </View>
        )}
      </View>

      <View style={styles.instructionRow}>
        <View style={styles.instructionIcon}>
          <Icons.ShieldCheckIcon size={18} color={colors.primary} weight="fill" />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Let's confirm it's really you</Text>
          <Text style={styles.instructionBody}>This quick check keeps your account and transactions secure.</Text>
        </View>
      </View>

      <View style={styles.instructionRow}>
        <View style={styles.instructionIcon}>
          <Icons.CameraIcon size={18} color={colors.primary} weight="fill" />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Center your face in the frame</Text>
          <Text style={styles.instructionBody}>
            Make sure your full face is visible and well-lit, and also take off your glasses, hats, or anything that
            covers your face.
          </Text>
        </View>
      </View>

      {result === 'rejected' ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Verification didn't pass</Text>
          <Text style={styles.resultBody}>Make sure your face is clearly visible and well-lit, then try again.</Text>
        </View>
      ) : result === 'pending' ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Still checking…</Text>
          <Text style={styles.pendingBody}>This is taking a little longer than usual. Please try again shortly.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Start Selfie Check" onPress={handleStartCheck} loading={submitting} />
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
  previewWrapper: {
    alignItems: 'center',
  },
  previewCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  previewPlaceholder: {
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  instructionIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    flex: 1,
    gap: 2,
  },
  instructionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  instructionBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray500,
    lineHeight: fontSize.xs * 1.5,
  },
  resultBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  resultTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  resultBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray600,
  },
  pendingBox: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pendingTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning,
  },
  pendingBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray600,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
});
