import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCard, ListingCardSkeleton, NewListingsBanner, RecentListingCard, ScreenContainer } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
import { extractErrorMessage } from '@/api/client';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { useSingleTap } from '@/hooks/useSingleTap';

const SECTION_LIMIT = 2;

export default function HomeScreen() {
  const { user, status } = useAuth();
  const { dismissNewListings } = useRealtime();
  const guard = useSingleTap();

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Flips true once the location prompt has been answered either way (granted or denied) — gates Recently Posted below so it doesn't fire ahead of Listings Near You; the two start together once the permission decision is known, rather than Recently Posted racing off on mount.
  const [locationResolved, setLocationResolved] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      };
    }, [])
  );

  useEffect(() => {
    getDeviceLocation().then((device) => {
      if (!device) {
        setLocationDenied(true);
        setLocationResolved(true);
        return;
      }
      setLocationDenied(false);
      setLocationLabel(device.label);
      setCoords({ lat: device.lat, lng: device.lng });
      setLocationResolved(true);
    });
  }, []);

  const nearbyParams = coords ? { lat: coords.lat, lng: coords.lng, radiusKm: DEFAULT_NEARBY_RADIUS_KM } : null;
  // Also gated on auth status — without it, a still-mounted Home can fire a fresh fetch the instant sign-out clears the query cache (an active/enabled observer refetches when its cache entry is removed out from under it), leaking an authenticated-only request past logout.
  const authed = status === 'authenticated';

  const {
    data: nearbyData,
    // isFetching, not isLoading — isLoading only covers the very first fetch (no data yet), so a
    // background refetch (tapping the "New listings available" banner after someone else's create,
    // or the app-wide list invalidate a delete anywhere now triggers) would otherwise swap this
    // section's data with no loading feedback at all. Teasers are small (2 items), so a brief
    // skeleton on every reload reads as "refreshing," not as a disruptive flash the way it would on
    // a long scrollable list (see nearbyListingsModal/newListingsModal, which deliberately go the
    // other way for exactly that reason).
    isFetching: nearbyFetching,
    error: nearbyQueryError,
    refetch: refetchNearby,
  } = useQuery({
    queryKey: queryKeys.listings.nearbyTeaser(nearbyParams ?? { lat: 0, lng: 0, radiusKm: DEFAULT_NEARBY_RADIUS_KM }),
    queryFn: () => listingsApi.getNearbyListings({ ...nearbyParams!, limit: SECTION_LIMIT }),
    enabled: !!nearbyParams && authed,
    staleTime: STALE_TIME.BROWSE,
  });
  const nearby = locationDenied ? [] : nearbyData?.results ?? null;
  const nearbyError = nearbyQueryError ? extractErrorMessage(nearbyQueryError, 'Could not load nearby listings.') : null;

  const {
    data: recentData,
    isFetching: recentFetching,
    error: recentQueryError,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: queryKeys.listings.newTeaser(),
    queryFn: () => listingsApi.getNewListings({ limit: SECTION_LIMIT }),
    enabled: locationResolved && authed,
    staleTime: STALE_TIME.BROWSE,
  });
  const recent = recentData?.results ?? null;
  const recentError = recentQueryError ? extractErrorMessage(recentQueryError, 'Could not load recent listings.') : null;

  const userLat = coords?.lat;
  const userLng = coords?.lng;

  // The native pull indicator is never held open — it retracts the instant the pull gesture completes. The skeletons (nearbyLoading/recentLoading) carry the rest of the loading feedback.
  // Also clears the "New listings available" banner — pulling to refresh here accomplishes the
  // same "user has now seen fresh data" outcome as tapping the banner itself, which was previously
  // the only way to dismiss it (NewListingsBanner only calls dismissNewListings from its own tap).
  function onRefresh() {
    refetchNearby();
    refetchRecent();
    dismissNewListings();
  }


  function goToSearch() {
    router.push('/(modals)/searchResultsModal');
  }

  function goToNearbyListings() {
    router.push('/(modals)/nearbyListingsModal');
  }

  function goToNewListings() {
    router.push('/(modals)/newListingsModal');
  }

  function goToListing(listingId: string) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: listingId } });
  }

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      ref={scrollRef}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.white}
        />
      }
      header={
        // ScreenContainer's `header` slot is deliberately full-bleed/unpadded (see ScreenHeader's
        // own doc comment) — this content used to be a normal scrollable child, getting its padding
        // for free from the ScrollView's contentContainerStyle, so it needs its own now.
        <View style={styles.homeHeader}>
          <Text style={styles.welcome}>Welcome back, {user?.name?.split(' ')[0] ?? 'there'}</Text>
          <View style={styles.locationRow}>
            <Icons.MapPinIcon size={verticalScale(18)} color={colors.gray400} />
            <Text style={styles.locationText}>
              {locationLabel ?? (locationDenied ? 'Location unavailable' : 'Finding your location…')}
            </Text>
          </View>
        </View>
      }
    >
      <Pressable onPress={guard(goToSearch)} style={styles.searchBar}>
        <Icon name="search-normal-1" variant="linear" size={verticalScale(18)} color={colors.gray400} />
        <Text style={styles.searchPlaceholder}>What are you looking for?</Text>
      </Pressable>

      <NewListingsBanner onRefresh={onRefresh} />

      <View style={styles.escrowBanner}>
        <View style={styles.escrowIconWrap}>
          <Icon name="shield" variant="bold" size={verticalScale(20)} color={colors.primary} />
        </View>
        <View style={styles.escrowText}>
          <Text style={styles.escrowTitle}>Escrow Protected</Text>
          <Text style={styles.escrowSubtitle}>All transactions are secured until you confirm.</Text>
        </View>
      </View>

      <ListingSection
        title="Listings Near You"
        subtitle={locationLabel ? `within ${DEFAULT_NEARBY_RADIUS_KM}km` : undefined}
        variant="all"
        listings={locationDenied ? [] : nearby}
        // useQuery's isFetching is false while `enabled` is false, so without the locationResolved check this would flash the empty state during the location prompt instead of a skeleton.
        loading={!locationResolved || nearbyFetching}
        emptyLabel={locationDenied ? 'Enable location to see listings near you.' : 'No nearby listings yet.'}
        error={nearbyError}
        onSeeAll={goToNearbyListings}
        renderCard={(listing, index) => (
          <Animated.View key={listing._id} entering={FadeInDown.delay(index * 70)}>
            <ListingCard listing={listing} userLat={userLat} userLng={userLng} onPress={() => goToListing(listing._id)} />
          </Animated.View>
        )}
      />

      <ListingSection
        title="Recently Posted"
        variant="recent"
        listings={recent}
        loading={!locationResolved || recentFetching}
        emptyLabel="No listings yet."
        error={recentError}
        onSeeAll={goToNewListings}
        renderCard={(listing, index) => (
          <Animated.View key={listing._id} entering={FadeInDown.delay(index * 70)}>
            <RecentListingCard listing={listing} userLat={userLat} userLng={userLng} onPress={() => goToListing(listing._id)} />
          </Animated.View>
        )}
      />
    </ScreenContainer>
  );
}

function ListingSection({
  title,
  subtitle,
  variant,
  listings,
  loading,
  emptyLabel,
  error,
  onSeeAll,
  renderCard,
}: {
  title: string;
  subtitle?: string;
  variant: string;
  listings: Listing[] | null;
  loading: boolean;
  emptyLabel: string;
  error: string | null;
  onSeeAll: () => void;
  renderCard: (listing: Listing, index: number) => React.ReactNode;
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

      {loading ? (
        <ListingCardSkeleton count={SECTION_LIMIT} variant={variant} />
      ) : listings && listings.length > 0 ? (
        listings.map((listing, index) => renderCard(listing, index))
      ) : error ? (
        <Text style={styles.sectionMessage}>{error}</Text>
      ) : (
        <EmptyState icon={Icons.PackageIcon} message={emptyLabel}  />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    paddingHorizontal: spacingX.lg,
    paddingTop: spacingY.xl,
  },
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
    marginBottom: spacingY.md,
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
    marginTop: -spacingX.md,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
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
  escrowIconWrap: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
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
  sectionMessage: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
    paddingVertical: spacingY.md,
  },
});
