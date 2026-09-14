import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingActionsSheet, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { formatCurrency } from '@/utils/helpers';
import { listingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import type { Listing, MyListingsStatusFilter } from '@/api/types';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useSingleTap } from '@/hooks/useSingleTap';

const SKELETON_COUNT = 3;
// Wider than tall — matches RecentListingCard's established "wide" image treatment.
const CARD_IMAGE_WIDTH = verticalScale(125);
const CARD_IMAGE_HEIGHT = verticalScale(96);

const STATUS_STYLES: Record<Listing['status'], { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: colors.successLight, text: colors.success },
  pending_sale: { label: 'Sales Pending', bg: colors.warningLight, text: colors.warning700 },
  sold: { label: 'Sold', bg: colors.primaryLight, text: colors.primary },
  reported: { label: 'Reported', bg: colors.dangerLight, text: colors.danger },
  paused: { label: 'Paused', bg: colors.gray100, text: colors.gray500 },
  delisted: { label: 'Delisted', bg: colors.dangerLight, text: colors.danger },
};
// listing.status's exact enum isn't fully confirmed backend-side — fall back rather than crash
// on a status string this map doesn't have a style for yet.
const FALLBACK_STATUS_STYLE = STATUS_STYLES.active;

const STATUS_TABS: { label: string; value: 'all' | MyListingsStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Sales Pending', value: 'pending_sale' },
  { label: 'Sold', value: 'sold' },
  { label: 'Reported', value: 'reported' },
  { label: 'Delisted', value: 'delisted' },
];

// FULL-SCREEN modal — Profile's "My Listings" row, GET /listings/mine.
export default function MyListingsModal() {
  const guard = useSingleTap();
  const [statusFilter, setStatusFilter] = useState<'all' | MyListingsStatusFilter>('all');
  const [actionListing, setActionListing] = useState<Listing | null>(null);

  // BROWSE, not STATIC: a buyer transacting on one of these listings changes its status with no
  // mutation on this device to invalidate it — see staleTimes.ts.
  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    queryKeys.listings.mineInfinite(statusFilter),
    ({ page, limit }) => listingsApi.getMyListings(page, limit, statusFilter === 'all' ? undefined : statusFilter),
    true,
    STALE_TIME.BROWSE
  );

  function onPostNewListing() {
    router.push('/(modals)/addItemModal');
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} background={colors.white} scroll={false} header={<ScreenHeader title="My Listings" />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {STATUS_TABS.map((tab) => {
          const active = tab.value === statusFilter;
          return (
            <Pressable key={tab.value} onPress={guard(() => setStatusFilter(tab.value))} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={loading ? [] : items}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70)}>
            <MyListingCard listing={item} onPress={() => setActionListing(item)} />
          </Animated.View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
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
            {statusFilter === 'all' && !loading && !refreshing && !loadingMore ? (
              <Pressable onPress={guard(onPostNewListing)} style={styles.postButton}>
                <Icons.PlusIcon size={verticalScale(18)} color={colors.gray700} weight="bold" />
                <Text style={styles.postButtonLabel}>Post a New Listing</Text>
              </Pressable>
            ) : null}
          </>
        }
      />

      {actionListing ? (
        <View style={StyleSheet.absoluteFill}>
          <ListingActionsSheet listing={actionListing} onClose={() => setActionListing(null)} />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

interface MyListingCardProps {
  listing: Listing;
  onPress: () => void;
}

/** "My Listings" row — status pill instead of location, plus a view count (0 until the backend returns viewCount; see comment on Listing). Tapping the card opens the actions sheet, not the listing detail screen directly — "View Listing" inside that sheet is the way there now. */
function MyListingCard({ listing, onPress }: MyListingCardProps) {
  const guard = useSingleTap();
  const status = STATUS_STYLES[listing.status] ?? FALLBACK_STATUS_STYLE;

  return (
    <Pressable onPress={guard(onPress)} style={styles.card}>
      <View style={styles.imageWrap}>
        {listing.mainImageUrl || listing.images[0] ? (
          <Image
            source={{ uri: listing.mainImageUrl || listing.images[0]?.secureUrl }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
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
          <Text style={styles.statsText}>{listing.views ?? 0} views</Text>
          <View style={styles.statsSpacer} />
          <Icons.DotsThreeIcon size={verticalScale(20)} color={colors.gray400} weight="bold" />
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
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    paddingBottom: spacingY.lg,
  },
  filterPill: {
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.md,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  filterPillLabelActive: {
    color: colors.white,
  },
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
    fontSize: scale(11),
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
  statsSpacer: {
    flex: 1,
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
