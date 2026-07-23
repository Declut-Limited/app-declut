import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';

export function Divider({ label = 'Or' }: { label?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
});
