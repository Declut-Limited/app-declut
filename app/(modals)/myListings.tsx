import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { formatCurrency } from '@/utils/helpers';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useSingleTap } from '@/hooks/useSingleTap';

const SKELETON_COUNT = 3;
// Wider than tall — matches RecentListingCard's established "wide" image treatment.
const CARD_IMAGE_WIDTH = verticalScale(125);
const CARD_IMAGE_HEIGHT = verticalScale(96);

const STATUS_STYLES: Record<Listing['status'], { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: colors.successLight, text: colors.success },
  sold: { label: 'Sold', bg: colors.primaryLight, text: colors.primary },
  archived: { label: 'Archived', bg: colors.gray100, text: colors.gray500 },
};

// FULL-SCREEN modal — Profile's "My Listings" row, GET /listings/mine.
export default function MyListingsModal() {
  const guard = useSingleTap();
  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(({ page, limit }) =>
    listingsApi.getMyListings(page, limit)
  );

  console.log("MY LISTINGS", items)

  function onPressListing(listing: Listing) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: listing._id, isMine: 'true' } });
  }

  function onPostNewListing() {
    router.push('/(modals)/addItemModal');
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} background={colors.white} scroll={false} header={<ScreenHeader title="My Listings" />}>
      <FlatList
        data={loading || refreshing ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70)}>
            <MyListingCard listing={item} onPress={() => onPressListing(item)} />
          </Animated.View>
        )}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading || refreshing ? (
            <MyListingCardSkeleton count={SKELETON_COUNT} />
          ) : error ? (
            <Text style={styles.message}>{error}</Text>
          ) : (
            <EmptyState icon={Icons.TagIcon} message="You haven't posted any listings yet." />
          )
        }
        ListFooterComponent={
          <>
            {loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
            <Pressable onPress={guard(onPostNewListing)} style={styles.postButton}>
              <Icons.PlusIcon size={verticalScale(18)} color={colors.gray700} weight="bold" />
              <Text style={styles.postButtonLabel}>Post a New Listing</Text>
            </Pressable>
          </>
        }
      />
    </ScreenContainer>
  );
}

interface MyListingCardProps {
  listing: Listing;
  onPress: () => void;
}

/** "My Listings" row — status pill instead of location, plus a view count (0 until the backend returns viewCount; see comment on Listing). */
function MyListingCard({ listing, onPress }: MyListingCardProps) {
  const guard = useSingleTap();
  const status = STATUS_STYLES[listing.status];

  return (
    <Pressable onPress={guard(onPress)} style={styles.card}>
      <View style={styles.imageWrap}>
        {listing.mainImageUrl || listing.images[0] ? (
          <Image source={{ uri: listing.mainImageUrl || listing.images[0]?.secureUrl }} style={styles.image} resizeMode="cover" />
        ) : null}
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {listing.title}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusLabel, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.price}>{formatCurrency(listing.price)}</Text>
        <View style={styles.divider} />
        <View style={styles.statsRow}>
          <Icons.EyeIcon size={verticalScale(16)} color={colors.gray400} />
          <Text style={styles.statsText}>{listing.viewCount ?? 0} views</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MyListingCardSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.card, styles.skeletonCard]}>
          <View style={styles.imageWrap} />
          <View style={styles.info}>
            <View style={styles.skeletonBoneWide} />
            <View style={styles.skeletonBoneNarrow} />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingBottom: spacingY.xl,
  },
  footerLoading: {
    paddingVertical: spacingY.lg,
  },
  message: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    paddingVertical: spacingY.xl,
    textAlign: 'center',
  },
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
    width: CARD_IMAGE_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    // Shows through while the remote image is still fetching — Image itself is transparent
    // until it has data, so without this the card looks blank rather than "loading".
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap: verticalScale(6),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  statusPill: {
    paddingHorizontal: spacingX.sm,
    paddingVertical: verticalScale(3),
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  statusLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: verticalScale(11),
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
  },
  statsText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingVertical: spacingY.lg,
    marginTop: spacingY.sm,
  },
  postButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  skeletonCard: {
    opacity: 0.6,
  },
  skeletonBoneWide: {
    width: '70%',
    height: verticalScale(16),
    borderRadius: 4,
    backgroundColor: colors.gray100,
  },
  skeletonBoneNarrow: {
    width: '40%',
    height: verticalScale(20),
    borderRadius: 4,
    backgroundColor: colors.gray100,
  },
});
