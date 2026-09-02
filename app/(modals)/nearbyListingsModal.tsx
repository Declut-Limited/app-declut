import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCard, ListingCardSkeleton, ScreenContainer, ScreenHeader } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useSingleTap } from '@/hooks/useSingleTap';

const SKELETON_COUNT = 6;

// FULL-SCREEN "SEE ALL" MODAL — Home's "Listings Near You" section, GET /listings/nearby
export default function NearbyListingsModal() {
  const guard = useSingleTap();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  // True while getDeviceLocation() is resolving (permission prompt + GPS fix) — without this, the
  // list's own skeleton never shows for that window, since usePaginatedListings stays disabled
  // until coords is set, and it would otherwise flash the "No nearby listings yet." empty state.
  const [resolvingLocation, setResolvingLocation] = useState(true);

  async function requestLocation() {
    setResolvingLocation(true);
    try {
      const device = await getDeviceLocation();
      if (!device) {
        setLocationDenied(true);
        return;
      }
      setLocationDenied(false);
      setCoords({ lat: device.lat, lng: device.lng });
    } finally {
      setResolvingLocation(false);
    }
  }

  useEffect(() => {
    requestLocation();
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

  function onPressListing(listing: Listing) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: listing._id } });
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      background={colors.white}
      scroll={false}
      header={<ScreenHeader title="Listings Near You" />}
    >
      {resolvingLocation ? (
        <ListingCardSkeleton count={SKELETON_COUNT} variant="all" />
      ) : locationDenied ? (
        <EmptyState
          icon={Icons.MapPinIcon}
          message="Enable location to see listings near you."
          action={
            <Pressable onPress={guard(requestLocation)} hitSlop={8}>
              <Text style={styles.allowLocationText}>Allow Location</Text>
            </Pressable>
          }
        />
      ) : (
        <FlatList
          data={loading || refreshing ? [] : items}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70)}>
              <ListingCard listing={item} userLat={coords?.lat} userLng={coords?.lng} onPress={() => onPressListing(item)} />
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading || refreshing ? (
              <ListingCardSkeleton count={SKELETON_COUNT} variant="all" />
            ) : error ? (
              <Text style={styles.message}>{error}</Text>
            ) : (
              <EmptyState icon={Icons.PackageIcon} message="No nearby listings yet." />
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
  allowLocationText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
