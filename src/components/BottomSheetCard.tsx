import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { BottomSheetCardProps } from '@/utils/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// SHEET OVERLAY — SIZES TO CONTENT, NO INTERNAL SCROLL. Used non-dismissibly by the KYC chain
// (no onBackdropPress) and dismissibly by one-off pickers like ConditionSheet (with it). Backdrop
// fades in, sheet slides up — applies to every consumer since it's all funneled through here.
export function BottomSheetCard({ style, children, onBackdropPress, ...rest }: BottomSheetCardProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AnimatedPressable entering={FadeIn.duration(200)} style={styles.backdrop} onPress={onBackdropPress} disabled={!onBackdropPress}>
        {/* Swallows the tap so it doesn't bubble up and trigger the backdrop's dismiss. */}
        <AnimatedPressable entering={SlideInDown.duration(300)} style={styles.sheet} onPress={() => {}}>
          <View style={styles.dragHandle} />
          <SafeAreaView edges={['bottom']}>
            <View style={[styles.content, style]} {...rest}>
              {children}
            </View>
          </SafeAreaView>
        </AnimatedPressable>
      </AnimatedPressable>
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
    gap: spacingY.md,
  },
});
