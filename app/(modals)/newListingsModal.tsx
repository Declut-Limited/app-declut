import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCardSkeleton, RecentListingCard, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { listingsApi } from '@/api';
import { getDeviceLocation } from '@/lib/location';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { showWarningToast } from '@/lib/toast';

const SKELETON_COUNT = 6;

// FULL-SCREEN "SEE ALL" MODAL — Home's "Recently Posted" section, GET /listings/new
export default function NewListingsModal() {
  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    ({ page, limit }) => listingsApi.getNewListings({ page, limit })
  );
  const { favoriteIds, toggleFavorite } = useFavoriteToggle();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Purely for the card's "(Xkm)" distance display — this list itself isn't location-filtered.
  useEffect(() => {
    getDeviceLocation().then((device) => {
      if (device) setCoords({ lat: device.lat, lng: device.lng });
    });
  }, []);

  function onPressListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      background={colors.white}
      scroll={false}
      header={<ScreenHeader title="Recently Posted" />}
    >
      <FlatList
        data={loading || refreshing ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70)}>
            <RecentListingCard
              listing={item}
              userLat={coords?.lat}
              userLng={coords?.lng}
              onPress={onPressListing}
              showFavorite
              favorited={favoriteIds.has(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          </Animated.View>
        )}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />}
        onEndReachedThreshold={0.4}
        onEndReached={hasMore ? loadMore : undefined}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading || refreshing ? (
            <ListingCardSkeleton count={SKELETON_COUNT} variant="recent" />
          ) : error ? (
            <Text style={styles.message}>{error}</Text>
          ) : (
            <EmptyState icon={Icons.PackageIcon} message="No listings yet." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
      />
    </ScreenContainer>
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
});
