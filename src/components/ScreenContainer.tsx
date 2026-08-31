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
  footer,
  edges = ['top', 'bottom'],
  style,
  children,
  refreshControl,
  avoidKeyboard = true,
  ...rest
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={edges}>
      <StatusBar style="dark" backgroundColor={background} />
      {header}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
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
          <View style={[styles.flexContent, style]} {...rest}>
            {children}
          </View>
        )}

        {/* Inside KeyboardAvoidingView (not after it) so it rides above the keyboard instead of being covered by it. */}
        {footer ? <View style={[styles.footer, { backgroundColor: background }]}>{footer}</View> : null}
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
  // `flex: 1` (not `flexGrow`) — a non-scrolling child like a FlatList needs a definite bounded
  // height from its parent to virtualize/scroll against; flexGrow alone doesn't reliably provide one.
  flexContent: {
    flex: 1,
    paddingHorizontal: spacingX['2xl'],
    paddingTop: spacingY.xl,
    paddingBottom: spacingY['2xl'],
  },
  footer: {
    paddingHorizontal: spacingX['2xl'],
    paddingTop: spacingY.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
});
