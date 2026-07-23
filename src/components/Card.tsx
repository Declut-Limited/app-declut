import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.base, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing['2xl'],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
});
