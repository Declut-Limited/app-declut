import React, { useState } from 'react';
import { Dimensions, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
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
import type { PillVariant } from '@/components/Pill';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
        style={styles.scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
      >
        {SLIDES.map((slide, index) => (
          <Slide
            key={slide.tag}
            slide={slide}
            index={index}
            scrollX={scrollX}
            activeIndex={activeIndex}
            total={SLIDES.length}
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
  activeIndex,
  total,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  scrollX: SharedValue<number>;
  activeIndex: number;
  total: number;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const distance = scrollX.value / SCREEN_WIDTH - index;
    return {
      opacity: interpolate(distance, [-1, 0, 1], [0.4, 1, 0.4]),
      transform: [{ scale: interpolate(distance, [-1, 0, 1], [0.92, 1, 0.92]) }],
    };
  });

  return (
    <View style={{ flex: 1, width: SCREEN_WIDTH }}>
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.cardTopBar}>
          <PaginationDots count={total} activeIndex={activeIndex} />
        </View>
        <Animated.Image source={slide.image} resizeMode="contain" style={styles.image} />
      </Animated.View>
      <View style={styles.content}>
        <Pill label={slide.tag} variant={slide.variant} />
        <Text style={styles.headline}>{slide.headline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xl,
  },
  card: {
    width: '100%',
    aspectRatio: 800 / 880,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * 1.25,
    color: colors.ink,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  linkSpacing: { height: spacing.lg },
});
