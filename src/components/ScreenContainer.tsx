import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';
import { StatusBar } from 'expo-status-bar';

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  background?: string;
}

/** Shared shell for onboarding/auth/KYC screens: safe area + keyboard avoidance + background. */
export function ScreenContainer({
  scroll = true,
  background = colors.background,
  style,
  children,
  ...rest
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={['top', 'bottom']}>
      <StatusBar style="dark" backgroundColor={background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, style]}
            keyboardShouldPersistTaps="handled"
            {...rest}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scrollContent, style]} {...rest}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
});
