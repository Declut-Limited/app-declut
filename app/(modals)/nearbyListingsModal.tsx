import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BackButton, ListingCard, ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';
import { listingsApi } from '@/api';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { showWarningToast } from '@/lib/toast';

// FULL-SCREEN "SEE ALL" MODAL — Home's "Listings Near You" section, GET /listings/nearby
export default function NearbyListingsModal() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

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
    <ScreenContainer edges={['top', 'bottom']} background={colors.white} scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Listings Near You</Text>
        <BackButton iconType="cancel" />
      </View>

      {locationDenied ? (
        <Text style={styles.message}>Enable location to see listings near you.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} onPress={onPressListing} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacingY.xl,
  },
  loading: {
    paddingVertical: spacingY['3xl'],
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
