import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacingX, spacingY } from '@/constants/theme';
import { StatusBar } from 'expo-status-bar';
import type { ScreenContainerProps } from '@/utils/types';

/** Shared shell for onboarding/auth/KYC screens: safe area + keyboard avoidance + background. */
export function ScreenContainer({
  scroll = true,
  background = colors.background,
  header,
  edges = ['top', 'bottom'],
  style,
  children,
  refreshControl,
  ...rest
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={edges}>
      <StatusBar style="dark" backgroundColor={background} />
      {header}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, style]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
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
    paddingHorizontal: spacingX['2xl'],
    paddingTop: spacingY.xl,
    paddingBottom: spacingY['2xl'],
  },
});
