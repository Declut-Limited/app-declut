import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { ListingCardVariant } from '@/utils/types';

const NEARBY_IMAGE_SIZE = verticalScale(112);
const RECENT_IMAGE_SIZE = verticalScale(96);

function Bone({ width, height, tint }: { width: number | `${number}%`; height: number; tint?: string }) {
  return <View style={[styles.bone, { width, height, backgroundColor: tint ?? colors.gray100 }]} />;
}

/** Mirrors NearbyListingCard: bigger image, tinted floating pill badge, plain heart glyph (no circular chip). */
function NearbySkeletonCard() {
  return (
    <View style={[styles.card, styles.nearbyCard]}>
      <View style={[styles.imageWrap, { width: NEARBY_IMAGE_SIZE, height: NEARBY_IMAGE_SIZE }]}>
        <View style={[styles.image, styles.nearbyImageRadius]} />
        <View style={[styles.pillBadge, styles.nearbyBadgeTint]} />
        <View style={styles.plainHeart} />
      </View>

      <View style={styles.nearbyInfo}>
        <Bone width="70%" height={verticalScale(16)} />
        <Bone width="45%" height={verticalScale(20)} />
        <View style={styles.dashedDivider} />
        <View style={styles.locationRow}>
          <Bone width="55%" height={verticalScale(13)} />
          <Bone width={verticalScale(36)} height={verticalScale(13)} />
        </View>
      </View>
    </View>
  );
}

/** Mirrors ListingCard: smaller image, solid floating pill badge, heart on a white circular chip. */
function RecentSkeletonCard() {
  return (
    <View style={[styles.card, styles.recentCard]}>
      <View style={[styles.imageWrap, { width: RECENT_IMAGE_SIZE, height: RECENT_IMAGE_SIZE }]}>
        <View style={[styles.image, styles.recentImageRadius]} />
        <View style={[styles.pillBadge, styles.recentBadgeTint]} />
        <View style={styles.circularHeart} />
      </View>

      <View style={styles.recentInfo}>
        <Bone width="65%" height={verticalScale(14)} />
        <Bone width="40%" height={verticalScale(16)} />
        <View style={styles.solidDivider} />
        <View style={styles.locationRow}>
          <Bone width="55%" height={verticalScale(12)} />
          <Bone width={verticalScale(36)} height={verticalScale(12)} />
        </View>
      </View>
    </View>
  );
}

/** Placeholder cards shown while a listing section is fetching or refetching — a simple Reanimated opacity pulse, no native dependencies beyond what's already installed. */
export function ListingCardSkeleton({ count = 2, variant = 'recent' }: { count?: number; variant?: ListingCardVariant }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const SkeletonCard = variant === 'nearby' ? NearbySkeletonCard : RecentSkeletonCard;

  return (
    <Animated.View style={pulseStyle}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    backgroundColor: colors.cardBackground,
    borderCurve: 'continuous',
    marginBottom: spacingY.md,
  },
  nearbyCard: {
    borderRadius: radius.xl,
    padding: spacingX.md,
  },
  recentCard: {
    borderRadius: radius.lg,
    padding: spacingX.sm,
  },
  imageWrap: {},
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray100,
    borderCurve: 'continuous',
  },
  nearbyImageRadius: {
    borderRadius: radius.lg,
  },
  recentImageRadius: {
    borderRadius: radius.md,
  },
  pillBadge: {
    position: 'absolute',
    top: spacingY.xs,
    left: spacingX.xs,
    width: verticalScale(28),
    height: verticalScale(12),
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  nearbyBadgeTint: {
    backgroundColor: colors.warningLight,
  },
  recentBadgeTint: {
    backgroundColor: colors.primaryLight,
  },
  // NearbyListingCard's heart is a bare glyph on the photo — just a soft tinted blob, no chip.
  plainHeart: {
    position: 'absolute',
    top: spacingY.xs,
    right: spacingX.xs,
    width: verticalScale(18),
    height: verticalScale(18),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  // ListingCard's heart sits on a solid white circular chip.
  circularHeart: {
    position: 'absolute',
    top: spacingY.xs,
    right: spacingX.xs,
    width: verticalScale(22),
    height: verticalScale(22),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.white,
  },
  nearbyInfo: {
    flex: 1,
    gap: verticalScale(6),
  },
  recentInfo: {
    flex: 1,
    gap: verticalScale(4),
  },
  dashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    marginVertical: verticalScale(2),
  },
  solidDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginVertical: verticalScale(2),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bone: {
    borderRadius: 4,
    borderCurve: 'continuous',
  },
});
