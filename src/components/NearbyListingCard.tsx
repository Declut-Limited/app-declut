import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import * as Icons from 'phosphor-react-native';
import Icon from './Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { formatCurrency, formatDistance } from '@/utils/helpers';
import type { NearbyListingCardProps } from '@/utils/types';

const NEW_WITHIN_DAYS = 7;
const IMAGE_SIZE = verticalScale(112);

/** "Listings Near You" / search-result card — tinted pill "New" badge, plain heart glyph on the photo, larger image. */
export function NearbyListingCard({ listing, onPress, userLat, userLng, showFavorite, favorited, onToggleFavorite }: NearbyListingCardProps) {
  const guard = useSingleTap();
  const isNew = dayjs().diff(dayjs(listing.createdAt), 'day') < NEW_WITHIN_DAYS;
  const distanceLabel =
    userLat !== undefined && userLng !== undefined
      ? `(${formatDistance(userLat, userLng, listing.location.lat, listing.location.lng).replace(' away', '')})`
      : null;

  return (
    <Pressable onPress={guard(onPress)} style={styles.card}>
      <View style={styles.imageWrap}>
        {listing.images[0] ? (
          <Image source={{ uri: listing.images[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {isNew ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>New</Text>
          </View>
        ) : null}
        {showFavorite ? (
          <Pressable
            onPress={onToggleFavorite ? guard(onToggleFavorite) : undefined}
            style={styles.favoriteButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icons.HeartIcon size={verticalScale(18)} weight="fill" color={favorited ? colors.danger : colors.white} />
          </Pressable>
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
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.md,
  },
  imageWrap: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  imagePlaceholder: {
    backgroundColor: colors.gray100,
  },
  // Floats above the image with a small gap, fully rounded, light tint fill + colored text.
  badge: {
    position: 'absolute',
    top: spacingY.xs,
    left: spacingX.xs,
    paddingHorizontal: spacingX.sm,
    paddingVertical: verticalScale(3),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.warningLight,
  },
  badgeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: verticalScale(10),
    color: colors.warning,
  },
  // No circular backing chip — a plain glyph floating on the photo.
  favoriteButton: {
    position: 'absolute',
    top: spacingY.xs,
    right: spacingX.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  info: {
    flex: 1,
    gap: verticalScale(6),
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.gray700,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
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
