import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize } from '@/constants/theme';

// STUB TAB — TRANSACTION HISTORY SCREEN NOT YET DESIGNED
export default function HistoryScreen() {
  return (
    <ScreenContainer edges={['top']} background={colors.white}>
      <Text style={styles.title}>History</Text>
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
