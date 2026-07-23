import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, PaginationDots, Pill, TextLink } from '@/components';
import type { PillVariant } from '@/components/Pill';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES: { tag: string; variant: PillVariant; headline: string }[] = [
  {
    tag: 'Buy & Sell',
    variant: 'primary',
    headline: 'Every payment is securely held in escrow until you confirm the item matches its description.',
  },
  {
    tag: 'Protected Payments',
    variant: 'success',
    headline: 'Pay for an item and inspect it in person, through an agent, or via a trusted delivery service.',
  },
  {
    tag: 'Resolve with Confidence',
    variant: 'warning',
    headline: 'Manage disputes, request refunds, and approve payments with protection at every stage.',
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  function handleMomentumEnd(offsetX: number) {
    setActiveIndex(Math.round(offsetX / SCREEN_WIDTH));
  }

  async function goToAuth(path: '/(auth)/sign-in' | '/(auth)/sign-up') {
    await completeOnboarding();
    router.replace(path);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
      >
        {SLIDES.map((slide, index) => (
          <Slide key={slide.tag} slide={slide} index={index} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <PaginationDots count={SLIDES.length} activeIndex={activeIndex} />
        <View style={styles.footerSpacing} />
        <Button label="Log in" variant="dark" onPress={() => goToAuth('/(auth)/sign-in')} />
        <View style={styles.linkSpacing} />
        <TextLink text="" actionLabel="Sign up" onPress={() => goToAuth('/(auth)/sign-up')} />
      </View>
    </SafeAreaView>
  );
}

function Slide({
  slide,
  index,
  scrollX,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  scrollX: SharedValue<number>;
}) {
  const illustrationStyle = useAnimatedStyle(() => {
    const distance = scrollX.value / SCREEN_WIDTH - index;
    return {
      opacity: interpolate(distance, [-1, 0, 1], [0.4, 1, 0.4]),
      transform: [{ scale: interpolate(distance, [-1, 0, 1], [0.92, 1, 0.92]) }],
    };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[styles.illustration, illustrationStyle]} />
      <View style={styles.content}>
        <Pill label={slide.tag} variant={slide.variant} />
        <Text style={styles.headline}>{slide.headline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  slide: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
  },
  illustration: {
    flex: 1,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    marginBottom: spacing['2xl'],
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * 1.25,
    color: colors.ink,
  },
  footer: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
  footerSpacing: { height: spacing.lg },
  linkSpacing: { height: spacing.lg },
});
