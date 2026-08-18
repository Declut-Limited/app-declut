import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import type { PillProps, PillVariant } from '@/utils/types';

const backgroundByVariant: Record<PillVariant, string> = {
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
};

export function Pill({ label, variant = 'primary' }: PillProps) {
  return (
    <View style={[styles.base, { backgroundColor: backgroundByVariant[variant] }]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: spacingY.xs,
    paddingHorizontal: spacingX.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  label: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },
});
