import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, ScreenContainer, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { useKycFlow } from '@/context/KycFlowContext';
import { verifyIdentity } from '@/api/kyc';
import { extractErrorMessage } from '@/api/client';

export default function SelfieCheckScreen() {
  const { nin } = useKycFlow();
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

      const response = await verifyIdentity({ nin, selfieImageBase64: photo.base64 });

      if (response.kycStatus === 'verified') {
        markKycVerified();
        router.replace('/');
      } else if (response.kycStatus === 'pending') {
        // Assumed /kyc/verify resolves synchronously (see CLAUDE.md) — this
        // branch is a fallback in case a provider call comes back async instead.
        setResult('pending');
      } else {
        setResult('rejected');
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Verification failed. Please try again.'));
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <ScreenContainer scroll={false}>
      <StepHeader step={3} total={3} />
      <Card style={styles.card}>
        <Text style={styles.headline}>Let's verify its you</Text>

        <View style={styles.cameraFrame}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.placeholderText}>Camera preview appears here</Text>
            </View>
          )}
          <View style={styles.faceGuide} />
        </View>

        {result === 'rejected' ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Verification didn't pass</Text>
            <Text style={styles.resultBody}>
              Make sure your face is clearly visible and well-lit, then try again.
            </Text>
          </View>
        ) : result === 'pending' ? (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingTitle}>Still checking…</Text>
            <Text style={styles.pendingBody}>This is taking a little longer than usual. Please try again shortly.</Text>
          </View>
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Let's confirm it's really you</Text>
            <Text style={styles.infoBody}>
              This quick check keeps your account and transactions secure. Center your face in the frame — make
              sure your full face is visible and well-lit, and take off your glasses, hats, or anything covering
              your face before starting.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Start Selfie Check" onPress={handleStartCheck} loading={submitting} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.lg,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  cameraFrame: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraPlaceholder: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  faceGuide: {
    position: 'absolute',
    width: 180,
    height: 220,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  infoBox: {
    backgroundColor: colors.gray50,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  infoTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  infoBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray500,
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
