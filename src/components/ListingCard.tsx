import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import Icon from './Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { formatCurrency, formatDistance } from '@/utils/helpers';
import type { ListingCardProps } from '@/utils/types';

const NEW_WITHIN_DAYS = 7;
const IMAGE_SIZE = verticalScale(96);

/** "Listings Near You" / search-result card — the only real differences from RecentListingCard are image width and badge tint. */
export function ListingCard({ listing, onPress, userLat, userLng }: ListingCardProps) {
  const guard = useSingleTap();
  const isNew = dayjs().diff(dayjs(listing.createdAt), 'day') < NEW_WITHIN_DAYS;
  const [listingLng, listingLat] = listing.location.coordinates;
  const distanceLabel =
    userLat !== undefined && userLng !== undefined
      ? `(${formatDistance(userLat, userLng, listingLat, listingLng).replace(' away', '')})`
      : null;

  return (
    <Pressable onPress={guard(onPress)} style={styles.card}>
      <View style={styles.imageWrap}>
        {listing.mainImageUrl || listing.images[0] ? (
          <Image source={{ uri: listing.mainImageUrl || listing.images[0]?.secureUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {isNew ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>New</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatCurrency(listing.price)}</Text>
        <View style={styles.divider} />
        <View style={styles.locationRow}>
          <View style={styles.locationLeft}>
            <Icon name="location" variant="bold" size={verticalScale(14)} color={colors.ink} />
            <Text style={styles.locationText} numberOfLines={1}>
              {listing.locationLabel}
            </Text>
          </View>
          {distanceLabel ? <Text style={styles.distanceText}>{distanceLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.xs,
    marginBottom: spacingY.md,
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  imagePlaceholder: {
    backgroundColor: colors.gray100,
  },
  badge: {
    position: 'absolute',
    top: spacingY.xs,
    left: spacingX.xs,
    paddingHorizontal: spacingX.sm,
    paddingVertical: verticalScale(3),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.warning25,
  },
  badgeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: verticalScale(10),
    color: colors.warning,
  },
  info: {
    flex: 1,
    gap: verticalScale(6),
  },
  title: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    marginVertical: verticalScale(2),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.xs,
  },
  locationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  locationText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  distanceText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
});
