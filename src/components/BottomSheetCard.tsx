import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { BottomSheetCardProps } from '@/utils/types';

// SHEET OVERLAY FOR THE KYC CHAIN — SIZES TO CONTENT, NO INTERNAL SCROLL
export function BottomSheetCard({ style, children, ...rest }: BottomSheetCardProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <SafeAreaView edges={['bottom']}>
            <View style={[styles.content, style]} {...rest}>
              {children}
            </View>
          </SafeAreaView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  dragHandle: {
    alignSelf: 'center',
    width: verticalScale(40),
    height: verticalScale(4),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray300,
    marginTop: spacingY.md,
    marginBottom: spacingY.xs,
  },
  content: {
    paddingHorizontal: spacingX.xl,
    paddingTop: spacingY.sm,
    paddingBottom: spacingY.xl,
    gap: spacingY.md,
  },
});
