import React from 'react';
import { ImageSourcePropType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, PaginationDots, Pill } from '@/components';
import type { PillVariant } from '@/utils/types';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

const SLIDES: { tag: string; variant: PillVariant; headline: string; image: ImageSourcePropType }[] = [
  {
    tag: 'Buy & Sell',
    variant: 'primary',
    headline: 'Every payment is securely held in escrow until you confirm the item matches its description.',
    image: require('../../assets/onboarding/onboarding-1.png'),
  },
  {
    tag: 'Protected Payments',
    variant: 'success',
    headline: 'Pay for an item and inspect it in person, through an agent, or via a trusted delivery service.',
    image: require('../../assets/onboarding/onboarding-2.png'),
  },
  {
    tag: 'Resolve with Confidence',
    variant: 'warning',
    headline: 'Manage disputes, request refunds, and approve payments with protection at every stage.',
    image: require('../../assets/onboarding/onboarding-3.png'),
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  async function goToAuth(path: '/(auth)/sign-in' | '/(auth)/sign-up') {
    await completeOnboarding();
    router.replace(path);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <PaginationDots count={SLIDES.length} scrollX={scrollX} screenWidth={screenWidth} />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, index) => (
          <Slide
            key={slide.tag}
            slide={slide}
            index={index}
            scrollX={scrollX}
            screenWidth={screenWidth}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <Button label="Log in" variant="dark" onPress={() => goToAuth('/(auth)/sign-in')} />
        <View style={styles.linkSpacing} />
        <Button label="Sign up" variant="ghost" onPress={() => goToAuth('/(auth)/sign-up')} />
      </View>
    </SafeAreaView>
  );
}

function Slide({
  slide,
  index,
  scrollX,
  screenWidth,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  scrollX: SharedValue<number>;
  screenWidth: number;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const distance = scrollX.value / screenWidth - index;
    return {
      opacity: interpolate(distance, [-1, 0, 1], [0.4, 1, 0.4]),
      transform: [{ scale: interpolate(distance, [-1, 0, 1], [0.92, 1, 0.92]) }],
    };
  });

  return (
    <View style={[styles.slide, { width: screenWidth }]}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.Image source={slide.image} resizeMode="contain" style={styles.image} />
      </Animated.View>
      <View style={styles.content}>
        <Pill label={slide.tag} variant={slide.variant} />
        <Text style={styles.headline} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.7}>
          {slide.headline}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flex: 1,
  },
  // Fixed above the paging ScrollView so it doesn't slide with the active slide's content.
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: spacingX.lg + spacingX.sm,
    paddingTop: spacingY.xl,
    paddingBottom: spacingY.xs,
  },
  // Horizontal inset lives here (per-slide), not on the ScrollView itself — padding on a
  // horizontal pagingEnabled ScrollView shrinks its viewport below each slide's declared width,
  // so paging snaps out of alignment and the next slide peeks in on the right edge.
  slide: {
    flex: 1,
    paddingHorizontal: spacingX.sm,
  },
  card: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingVertical: spacingY.sm,
    paddingHorizontal: spacingX.sm,
    marginBottom: spacingY['2xl'],
  },
  image: {
    flex: 1,
    width: '100%',
  },
  content: {
    gap: spacingY.md,
    paddingBottom: spacingY.lg,
    paddingHorizontal: spacingX.lg,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * 1.5,
    color: colors.ink,
  },
  footer: {
    paddingHorizontal: spacingX.lg,
    paddingBottom: spacingY.xl,
  },
  linkSpacing: { height: spacingY.lg },
});
