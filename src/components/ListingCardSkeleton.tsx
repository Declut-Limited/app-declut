import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';

const IMAGE_SIZE = verticalScale(96);
const RECENT_IMAGE_WIDTH = verticalScale(120);
const RECENT_IMAGE_HEIGHT = verticalScale(96);

function Bone({ width, height, tint }: { width: number | `${number}%`; height: number; tint?: string }) {
  return <View style={[styles.bone, { width, height, backgroundColor: tint ?? colors.gray100 }]} />;
}

function ListingSkeletonCard() {
  return (
    <View style={[styles.card, styles.listingCard]}>
      <View style={[styles.imageWrap, { width: IMAGE_SIZE, height: IMAGE_SIZE }]}>
        <View style={[styles.image, styles.nearbyImageRadius]} />
        <View style={[styles.pillBadge, styles.badgeTint]} />
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

function RecentSkeletonCard() {
  return (
    <View style={[styles.card, styles.recentCard]}>
      <View style={[styles.imageWrap, { width: RECENT_IMAGE_WIDTH, height: RECENT_IMAGE_HEIGHT }]}>
        <View style={[styles.image, styles.recentImageRadius]} />
        <View style={[styles.pillBadge, styles.badgeTint]} />
        <View style={styles.plainHeart} />
      </View>

      <View style={styles.recentInfo}>
        <Bone width="65%" height={verticalScale(14)} />
        <Bone width="40%" height={verticalScale(16)} />
        <View style={styles.dashedDivider} />
        <View style={styles.locationRow}>
          <Bone width="55%" height={verticalScale(12)} />
          <Bone width={verticalScale(36)} height={verticalScale(12)} />
        </View>
      </View>
    </View>
  );
}

/** Placeholder cards shown while a listing section is fetching or refetching — a simple Reanimated opacity pulse, no native dependencies beyond what's already installed. */
export function ListingCardSkeleton({ count = 2, variant = 'recent' }: { count?: number; variant?: string }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const SkeletonCard = variant === 'recent' ? RecentSkeletonCard : ListingSkeletonCard;

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
  listingCard: {
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
  badgeTint: {
    backgroundColor: colors.primaryLight,
  },
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
