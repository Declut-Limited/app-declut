import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { ListingCard, ScreenContainer } from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi, favoritesApi } from '@/api';
import type { Listing } from '@/api/types';
import { extractErrorMessage } from '@/api/client';
import { getDeviceLocation } from '@/lib/location';
import { useSingleTap } from '@/hooks/useSingleTap';
import { showWarningToast } from '@/lib/toast';

const NEARBY_RADIUS_KM = 5;
const SECTION_LIMIT = 4;

export default function HomeScreen() {
  const { user } = useAuth();
  const guard = useSingleTap();

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [nearby, setNearby] = useState<Listing[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Listing[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const device = await getDeviceLocation();
      if (!device) {
        setLocationDenied(true);
        return;
      }
      setLocationLabel(device.label);
      try {
        const result = await listingsApi.searchListings({
          lat: device.lat,
          lng: device.lng,
          radiusKm: NEARBY_RADIUS_KM,
          limit: SECTION_LIMIT,
        });
        setNearby(result.items ?? []);
      } catch (e) {
        setNearbyError(extractErrorMessage(e, 'Could not load nearby listings.'));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const result = await listingsApi.searchListings({ limit: SECTION_LIMIT });
        setRecent(result.items ?? []);
      } catch (e) {
        setRecentError(extractErrorMessage(e, 'Could not load recent listings.'));
      }
    })();
  }, []);

  const toggleFavorite = useCallback((listingId: string) => {
    setFavoriteIds((prev) => {
      const wasFavorited = prev.has(listingId);
      const next = new Set(prev);
      if (wasFavorited) next.delete(listingId);
      else next.add(listingId);

      const request = wasFavorited ? favoritesApi.removeFavorite(listingId) : favoritesApi.addFavorite(listingId);
      request.catch(() => {
        setFavoriteIds((current) => {
          const reverted = new Set(current);
          if (wasFavorited) reverted.add(listingId);
          else reverted.delete(listingId);
          return reverted;
        });
      });

      return next;
    });
  }, []);

  function goToSearch() {
    router.push('/(app)/search');
  }

  function goToListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  return (
    <ScreenContainer edges={['top']} background={colors.white}>
      <Text style={styles.welcome}>Welcome back, {user?.name?.split(' ')[0] ?? 'there'}</Text>
      <View style={styles.locationRow}>
        <Icons.MapPinIcon size={verticalScale(18)} color={colors.gray400} />
        <Text style={styles.locationText}>
          {locationLabel ?? (locationDenied ? 'Location unavailable' : 'Finding your location…')}
        </Text>
      </View>

      <Pressable onPress={guard(goToSearch)} style={styles.searchBar}>
        <Icons.MagnifyingGlassIcon size={verticalScale(18)} color={colors.gray400} />
        <Text style={styles.searchPlaceholder}>What are you looking for?</Text>
        <Pressable onPress={guard(goToSearch)} style={styles.filterButton} hitSlop={8}>
          <Icons.SlidersIcon size={verticalScale(16)} color={colors.white} />
        </Pressable>
      </Pressable>

      <View style={styles.escrowBanner}>
        <Icons.ShieldCheckIcon size={verticalScale(20)} color={colors.primary} weight="fill" />
        <View style={styles.escrowText}>
          <Text style={styles.escrowTitle}>Escrow Protected</Text>
          <Text style={styles.escrowSubtitle}>All transactions are secured until you confirm.</Text>
        </View>
      </View>

      <ListingSection
        title="Listings Near You"
        subtitle={locationLabel ? `within ${NEARBY_RADIUS_KM}km` : undefined}
        listings={locationDenied ? [] : nearby}
        emptyLabel={locationDenied ? 'Enable location to see listings near you.' : 'No nearby listings yet.'}
        error={nearbyError}
        onSeeAll={goToSearch}
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
        onSeeAll={goToSearch}
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

      {error ? (
        <Text style={styles.sectionMessage}>{error}</Text>
      ) : listings === null ? (
        <ActivityIndicator color={colors.primary} style={styles.sectionLoading} />
      ) : listings.length === 0 ? (
        <Text style={styles.sectionMessage}>{emptyLabel}</Text>
      ) : (
        listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onPress={() => onPressListing(listing.id)}
            showFavorite={showFavorite}
            favorited={favoriteIds?.has(listing.id)}
            onToggleFavorite={() => onToggleFavorite?.(listing.id)}
          />
        ))
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
    fontSize: fontSize.sm,
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
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  escrowSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
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
    fontSize: fontSize.md,
    color: colors.ink,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  seeAll: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.warning,
  },
  sectionLoading: {
    paddingVertical: spacingY.lg,
  },
  sectionMessage: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    paddingVertical: spacingY.md,
  },
});
