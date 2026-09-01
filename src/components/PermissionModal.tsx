import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

interface PermissionModalProps {
  /** Appended to "Declut wants to access" — e.g. "your gallery", "your camera". */
  target: string;
  message: string;
  onAllow: () => void;
  onDismiss: () => void;
}

// Generic two-button "primer" card — currently used only for the hard-denied permission case.
export function PermissionModal({ target, message, onAllow, onDismiss }: PermissionModalProps) {
  const guard = useSingleTap();

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop} />
      <Animated.View entering={SlideInDown.duration(300)} style={styles.card}>
        <Text style={styles.title}>Declut wants to access {target}</Text>
        <View style={styles.divider} />
        <Text style={styles.message}>{message}</Text>
        <Pressable onPress={guard(onAllow)} style={styles.allowButton}>
          <Text style={styles.allowLabel}>Allow</Text>
        </Pressable>
        <Pressable onPress={guard(onDismiss)} hitSlop={8}>
          <Text style={styles.dismissLabel}>Don't Allow</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX['2xl'],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingTop: spacingY.xl,
    paddingHorizontal: spacingX.xl,
    paddingBottom: spacingY.xl,
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacingY.lg,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacingY.lg,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * 1.5,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacingY.xl,
  },
  allowButton: {
    alignSelf: 'stretch',
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingY.lg,
  },
  allowLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  dismissLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
});
