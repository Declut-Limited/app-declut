import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components';
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Oops! Something went wrong.</Text>
      <Text style={styles.message}>{getErrorMessage(error)}</Text>
      <Button label="Reload App" onPress={resetErrorBoundary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacingX.xl,
    paddingVertical: spacingY.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacingY.md,
  },
});
