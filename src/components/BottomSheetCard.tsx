import React, { useRef } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { BottomSheetCardProps } from '@/utils/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SCREEN_HEIGHT = Dimensions.get('window').height;
const OPEN_SPRING = { damping: 18, stiffness: 180, overshootClamping: true };
const CLOSE_DURATION = 220;
const DISMISS_DISTANCE_RATIO = 0.3; // drag past 30% of the sheet's own height dismisses
const DISMISS_VELOCITY = 800; // px/s — a fast fling dismisses regardless of distance

// SHEET OVERLAY — SIZES TO CONTENT, NO INTERNAL SCROLL. Used non-dismissibly by the KYC chain
// (no onBackdropPress) and dismissibly by one-off pickers like ConditionSheet (with it). Backdrop
// opacity and the sheet's slide are driven by the same translateY value — dragging the handle (or
// tapping the backdrop, when dismissible) fades the backdrop in lockstep with the sheet's position
// rather than as an independent, disconnected animation.
export function BottomSheetCard({ style, children, onBackdropPress, ...rest }: BottomSheetCardProps) {
  const dismissible = !!onBackdropPress;
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const sheetHeight = useSharedValue(0);
  const hasEntered = useRef(false);

  function requestClose() {
    onBackdropPress?.();
  }

  function close() {
    'worklet';
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: CLOSE_DURATION }, (finished) => {
      if (finished) runOnJS(requestClose)();
    });
  }

  function handleSheetLayout(height: number) {
    sheetHeight.value = height;
    if (!hasEntered.current) {
      hasEntered.current = true;
      translateY.value = withSpring(0, OPEN_SPRING);
    }
  }

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const draggedPastThreshold = translateY.value > sheetHeight.value * DISMISS_DISTANCE_RATIO;
      const flungDown = event.velocityY > DISMISS_VELOCITY;
      if (draggedPastThreshold || flungDown) {
        close();
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, sheetHeight.value || 1], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.backdrop}>
        {/* Dims independently of the sheet below — must stay a separate layer, not a parent of the sheet, or animating its opacity would fade the sheet's content along with it. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? close : undefined} disabled={!dismissible} />
        <AnimatedPressable style={[styles.sheet, sheetStyle]} onPress={() => {}} onLayout={(event) => handleSheetLayout(event.nativeEvent.layout.height)}>
          <GestureDetector gesture={pan}>
            <View style={styles.handleZone}>
              <View style={styles.dragHandle} />
            </View>
          </GestureDetector>
          <SafeAreaView edges={['bottom']}>
            <View style={[styles.content, style]} {...rest}>
              {children}
            </View>
          </SafeAreaView>
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
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
  handleZone: {
    alignItems: 'center',
    paddingTop: spacingY.md,
    paddingBottom: spacingY.xs,
  },
  dragHandle: {
    width: verticalScale(40),
    height: verticalScale(4),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray300,
  },
  content: {
    paddingHorizontal: spacingX.xl,
    paddingTop: spacingY.sm,
    gap: spacingY.md,
  },
});
