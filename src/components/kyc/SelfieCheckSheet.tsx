import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard, Button, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';

export function SelfieCheckSheet() {
  const { markKycVerified } = useAuth();
  const [permission] = useCameraPermissions();

  // TEMPORARY — /kyc/liveness-check isn't live on the backend yet. Skip the
  // capture/submit round trip, mark verified locally, and let the user in;
  // swap back to the real capture + API call once it ships (see CLAUDE.md).
  function handleStartCheck() {
    markKycVerified();
    router.replace('/');
  }

  return (
    <BottomSheetCard>
      <StepHeader step={3} total={3} />
      <Text style={styles.headline}>Let's verify its you</Text>

      <View style={styles.previewWrapper}>
        {permission?.granted ? (
          <CameraView style={styles.previewCircle} facing="front" />
        ) : (
          <View style={[styles.previewCircle, styles.previewPlaceholder]}>
            <Icons.CameraIcon size={verticalScale(28)} color={colors.gray400} />
          </View>
        )}
      </View>

      <View style={styles.instructionRow}>
        <View style={styles.instructionIcon}>
          <Icons.ShieldCheckIcon size={verticalScale(18)} color={colors.primary} weight="fill" />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Let's confirm it's really you</Text>
          <Text style={styles.instructionBody}>This quick check keeps your account and transactions secure.</Text>
        </View>
      </View>

      <View style={styles.instructionRow}>
        <View style={styles.instructionIcon}>
          <Icons.CameraIcon size={verticalScale(18)} color={colors.primary} weight="fill" />
        </View>
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Center your face in the frame</Text>
          <Text style={styles.instructionBody}>
            Make sure your full face is visible and well-lit, and also take off your glasses, hats, or anything that
            covers your face.
          </Text>
        </View>
      </View>

      <Button label="Start Selfie Check" onPress={handleStartCheck} />
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
    width: verticalScale(96),
    height: verticalScale(96),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  previewPlaceholder: {
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionRow: {
    flexDirection: 'row',
    gap: spacingX.md,
  },
  instructionIcon: {
    width: verticalScale(32),
    height: verticalScale(32),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    flex: 1,
    gap: verticalScale(2),
  },
  instructionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  instructionBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray500,
    lineHeight: fontSize.xs * 1.5,
  },
});
