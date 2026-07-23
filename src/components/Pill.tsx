import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';

export type PillVariant = 'primary' | 'success' | 'warning';

interface PillProps {
  label: string;
  variant?: PillVariant;
}

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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  label: {
    color: colors.white,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },
});
