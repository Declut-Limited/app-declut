import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';

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
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX['2xl'],
    paddingVertical: spacingY['2xl'],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
});
