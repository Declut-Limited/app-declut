import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';

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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
