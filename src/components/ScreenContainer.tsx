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

// /** Shared shell for onboarding/auth/KYC screens: safe area + keyboard avoidance + background. */
// export function ScreenContainer({
/** Shared shell for onboarding/auth/KYC screens: safe area + keyboard avoidance + background.
 *  Forwards a ref to the internal ScrollView (when scroll=true) — e.g. so a tab screen can reset
 *  its scroll position on blur, since tab screens stay mounted across tab switches instead of
 *  unmounting like stack/modal screens. The ref is simply unused when scroll=false. */
export const ScreenContainer = React.forwardRef<ScrollView, ScreenContainerProps>(function ScreenContainer(
  {
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
// }: ScreenContainerProps) {  
  },
  ref
) {
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={edges}>
      <StatusBar style="dark" backgroundColor={background} />
      {header}

      <KeyboardAvoidingView
        style={styles.flex}
        // behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
        behavior={avoidKeyboard && Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            ref={ref}
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
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.xl,
    paddingBottom: spacingY['2xl'],
  },
  flexContent: {
    flex: 1,
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.xl,
    paddingBottom: spacingY['2xl'],
  },
  footer: {
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
});
