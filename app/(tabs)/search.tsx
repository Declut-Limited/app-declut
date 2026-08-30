import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize } from '@/constants/theme';

// STUB TAB — SEARCH/FILTER SCREEN NOT YET DESIGNED
export default function SearchScreen() {
  return (
    <ScreenContainer edges={['top']} background={colors.white}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>This screen hasn't been designed yet.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
});
