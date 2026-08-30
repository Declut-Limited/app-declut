import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { formatCurrency } from '@/utils/helpers';
import type { ListingCardProps } from '@/utils/types';

const NEW_WITHIN_DAYS = 7;
const IMAGE_SIZE = verticalScale(76);

export function ListingCard({ listing, onPress, showFavorite, favorited, onToggleFavorite }: ListingCardProps) {
  const guard = useSingleTap();
  const isNew = dayjs().diff(dayjs(listing.createdAt), 'day') < NEW_WITHIN_DAYS;

  return (
    <Pressable onPress={guard(onPress)} style={styles.row}>
      <View style={styles.imageWrap}>
        {listing.images[0] ? (
          <Image source={{ uri: listing.images[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeLabel}>New</Text>
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
            <Icons.HeartIcon
              size={verticalScale(14)}
              weight={favorited ? 'fill' : 'regular'}
              color={favorited ? colors.danger : colors.white}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatCurrency(listing.price)}</Text>
        <View style={styles.locationRow}>
          <Icons.MapPinIcon size={verticalScale(12)} color={colors.gray400} />
          <Text style={styles.locationText} numberOfLines={1}>
            {listing.locationLabel}
            {listing.distanceKm !== undefined ? ` (${listing.distanceKm.toFixed(1)}km)` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingVertical: spacingY.sm,
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
  newBadge: {
    position: 'absolute',
    top: spacingY.xs,
    left: spacingX.xs,
    backgroundColor: colors.warning,
    paddingHorizontal: spacingX.xs,
    paddingVertical: verticalScale(2),
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  newBadgeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: verticalScale(9),
    color: colors.white,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacingY.xs,
    right: spacingX.xs,
    width: verticalScale(22),
    height: verticalScale(22),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: verticalScale(2),
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  price: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  locationText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
});
