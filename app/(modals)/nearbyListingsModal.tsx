import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ListingCardSkeleton, NearbyListingCard, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { listingsApi } from '@/api';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { showWarningToast } from '@/lib/toast';

const SKELETON_COUNT = 6;

// FULL-SCREEN "SEE ALL" MODAL — Home's "Listings Near You" section, GET /listings/nearby
export default function NearbyListingsModal() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const { favoriteIds, toggleFavorite } = useFavoriteToggle();

  useEffect(() => {
    (async () => {
      const device = await getDeviceLocation();
      if (!device) {
        setLocationDenied(true);
        return;
      }
      setCoords({ lat: device.lat, lng: device.lng });
    })();
  }, []);

  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    ({ page, limit }) =>
      listingsApi.getNearbyListings({
        lat: coords!.lat,
        lng: coords!.lng,
        radiusKm: DEFAULT_NEARBY_RADIUS_KM,
        page,
        limit,
      }),
    coords !== null
  );

  function onPressListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      background={colors.white}
      scroll={false}
      header={<ScreenHeader title="Listings Near You" />}
    >
      {locationDenied ? (
        <Text style={styles.message}>Enable location to see listings near you.</Text>
      ) : (
        <FlatList
          data={loading || refreshing ? [] : items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70)}>
              <NearbyListingCard
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
              <ListingCardSkeleton count={SKELETON_COUNT} variant="nearby" />
            ) : (
              <Text style={styles.message}>{error ?? 'No nearby listings yet.'}</Text>
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
        />
      )}
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
