import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCard, ListingCardSkeleton, RecentListingCard, ScreenContainer } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { useSingleTap } from '@/hooks/useSingleTap';

const SECTION_LIMIT = 2;

export default function HomeScreen() {
  const { user } = useAuth();
  const guard = useSingleTap();

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLng, setUserLng] = useState<number | undefined>(undefined);
  const [nearby, setNearby] = useState<Listing[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Listing[] | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const loadNearby = useCallback(async () => {
    setNearbyLoading(true);
    try {
      const device = await getDeviceLocation();
      if (!device) {
        setLocationDenied(true);
        return;
      }
      setLocationDenied(false);
      setLocationLabel(device.label);
      setUserLat(device.lat);
      setUserLng(device.lng);
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
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const data = await listingsApi.getNewListings({ limit: SECTION_LIMIT });
      setRecent(data.results ?? []);
      setRecentError(null);
    } catch (e) {
      setRecentError(extractErrorMessage(e, 'Could not load recent listings.'));
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // The native pull indicator is never held open — `refreshing` always resolves to false, so it
  // retracts the instant the pull gesture completes. The skeletons (nearbyLoading/recentLoading,
  // set inside loadNearby/loadRecent above) carry the rest of the loading feedback from there.
  function onRefresh() {
    loadNearby();
    loadRecent();
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
      refreshControl={
        <RefreshControl
          refreshing={false}
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
      </Pressable>

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
        loading={nearbyLoading}
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
        loading={recentLoading}
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
