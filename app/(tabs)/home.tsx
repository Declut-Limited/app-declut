import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { ListingCard, ScreenContainer } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { showWarningToast } from '@/lib/toast';

const SECTION_LIMIT = 2;

export default function HomeScreen() {
  const { user } = useAuth();
  const guard = useSingleTap();
  const { favoriteIds, toggleFavorite } = useFavoriteToggle();

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [nearby, setNearby] = useState<Listing[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Listing[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNearby = useCallback(async () => {
    const device = await getDeviceLocation();
    if (!device) {
      setLocationDenied(true);
      return;
    }
    setLocationDenied(false);
    setLocationLabel(device.label);
    try {
      const data = await listingsApi.getNearbyListings({
        lat: device.lat,
        lng: device.lng,
        radiusKm: DEFAULT_NEARBY_RADIUS_KM,
        limit: SECTION_LIMIT,
      });
      setNearby(data.results ?? []);
      setNearbyError(null);
    } catch (e) {
      setNearbyError(extractErrorMessage(e, 'Could not load nearby listings.'));
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const data = await listingsApi.getNewListings({ limit: SECTION_LIMIT });
      setRecent(data.results ?? []);
      setRecentError(null);
    } catch (e) {
      setRecentError(extractErrorMessage(e, 'Could not load recent listings.'));
    }
  }, []);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadNearby(), loadRecent()]);
    setRefreshing(false);
  }

  function goToSearch() {
    router.push('/(tabs)/search');
  }

  function goToNearbyListings() {
    router.push('/(modals)/nearbyListingsModal');
  }

  function goToNewListings() {
    router.push('/(modals)/newListingsModal');
  }

  function goToListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.white}
        />
      }
    >
      <Text style={styles.welcome}>Welcome back, {user?.name?.split(' ')[0] ?? 'there'}</Text>
      <View style={styles.locationRow}>
        <Icons.MapPinIcon size={verticalScale(18)} color={colors.gray400} />
        <Text style={styles.locationText}>
          {locationLabel ?? (locationDenied ? 'Location unavailable' : 'Finding your location…')}
        </Text>
      </View>

      <Pressable onPress={guard(goToSearch)} style={styles.searchBar}>
        <Icon name="search-normal-1" variant="linear" size={verticalScale(18)} color={colors.gray400} />
        <Text style={styles.searchPlaceholder}>What are you looking for?</Text>
        <Pressable onPress={guard(goToSearch)} style={styles.filterButton} hitSlop={8}>
          <Icon name="setting-3" variant="linear" size={verticalScale(16)} color={colors.white} />
        </Pressable>
      </Pressable>

      <View style={styles.escrowBanner}>
        <Icon name="shield" variant="bold" size={verticalScale(20)} color={colors.primary} />
        <View style={styles.escrowText}>
          <Text style={styles.escrowTitle}>Escrow Protected</Text>
          <Text style={styles.escrowSubtitle}>All transactions are secured until you confirm.</Text>
        </View>
      </View>

      <ListingSection
        title="Listings Near You"
        subtitle={locationLabel ? `within ${DEFAULT_NEARBY_RADIUS_KM}km` : undefined}
        listings={locationDenied ? [] : nearby}
        emptyLabel={locationDenied ? 'Enable location to see listings near you.' : 'No nearby listings yet.'}
        error={nearbyError}
        onSeeAll={goToNearbyListings}
        onPressListing={goToListing}
      />

      <ListingSection
        title="Recently Posted"
        listings={recent}
        emptyLabel="No listings yet."
        error={recentError}
        showFavorite
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onSeeAll={goToNewListings}
        onPressListing={goToListing}
      />
    </ScreenContainer>
  );
}

function ListingSection({
  title,
  subtitle,
  listings,
  emptyLabel,
  error,
  showFavorite,
  favoriteIds,
  onToggleFavorite,
  onSeeAll,
  onPressListing,
}: {
  title: string;
  subtitle?: string;
  listings: Listing[] | null;
  emptyLabel: string;
  error: string | null;
  showFavorite?: boolean;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (listingId: string) => void;
  onSeeAll: () => void;
  onPressListing: (listingId: string) => void;
}) {
  const guard = useSingleTap();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title}
          {subtitle ? <Text style={styles.sectionSubtitle}> ({subtitle})</Text> : null}
        </Text>
        <Pressable onPress={guard(onSeeAll)}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      {listings && listings?.length > 0 ? (
        listings.map((listing) => (
          <ListingCard
            key={listing._id}
            listing={listing}
            onPress={() => onPressListing(listing.id)}
            showFavorite={showFavorite}
            favorited={favoriteIds?.has(listing.id)}
            onToggleFavorite={() => onToggleFavorite?.(listing.id)}
          />
        ))
      ) : error ? (
        <Text style={styles.sectionMessage}>{error}</Text>
      ) : listings === null ? (
        <ActivityIndicator color={colors.primary} style={styles.sectionLoading} />
      ) : (
        <Text style={styles.sectionMessage}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: {
    fontFamily: fontFamily.display_400,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * 1.2,
    color: colors.ink,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: verticalScale(2),
    marginBottom: spacingY.lg,
  },
  locationText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.gray400,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    minHeight: verticalScale(52),
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingLeft: spacingX.lg,
    paddingRight: spacingX.sm,
    marginBottom: spacingY.lg,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
  },
  filterButton: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escrowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.xl,
  },
  escrowText: {
    flex: 1,
    gap: verticalScale(2),
  },
  escrowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  escrowSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primaryDark,
  },
  section: {
    marginBottom: spacingY.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.sm,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
  seeAll: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning,
  },
  sectionLoading: {
    paddingVertical: spacingY.lg,
  },
  sectionMessage: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
    paddingVertical: spacingY.md,
  },
});
