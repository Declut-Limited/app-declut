import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';

export interface EmptyStateProps {
  icon: PhosphorIcon;
  message: string;
  /** Optional tiny action below the message — e.g. "Allow Location". */
  action?: ReactNode;
}

/** Standard "nothing here yet" treatment — centered icon + message. Used everywhere a list/section has no data. */
export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={verticalScale(40)} color={colors.gray300} />
      <Text style={styles.message}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingY.md,
    paddingVertical: spacingY['3xl'],
  },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
  },
});
