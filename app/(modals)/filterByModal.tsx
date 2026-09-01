import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { FormDropdown, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { categoriesApi, listingsApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { Category } from '@/api/types';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';
import { showWarningToast } from '@/lib/toast';
import { toListingSearchParams, useSearchFilter } from '@/contexts/SearchFilterContext';
import type { SearchFilters } from '@/contexts/SearchFilterContext';

const CATEGORY_PAGE_LIMIT = 20;
// No listings-count-by-filter endpoint exists yet — Price Range just needs sane outer bounds for the slider.
const PRICE_BOUND_MIN = 0;
const PRICE_BOUND_MAX = 1_000_000;

const TRACK_HEIGHT = verticalScale(4);
const TRACK_WRAP_HEIGHT = verticalScale(40);
const THUMB_SIZE = verticalScale(20);
const TRACK_TOP = (TRACK_WRAP_HEIGHT - TRACK_HEIGHT) / 2;
const THUMB_TOP = (TRACK_WRAP_HEIGHT - THUMB_SIZE) / 2;

const switchProps = {
  trackColor: { false: colors.gray200, true: colors.primary },
  thumbColor: colors.white,
  ios_backgroundColor: colors.gray200,
  style: [{ transform: [{ scale: 1.2 }] }],
};

function clamp(value: number, lo: number, hi: number) {
  return Math.min(Math.max(value, lo), hi);
}

// FULL-SCREEN "FILTER BY" MODAL — triggered from Home's search-bar filter button.
export default function FilterByModal() {
  const guard = useSingleTap();
  const { keyword, filters: committedFilters, setFilters: commitFilters } = useSearchFilter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesHasMore, setCategoriesHasMore] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadingMore, setCategoriesLoadingMore] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // The backend only takes a single categoryId, so this is effectively single-select — see toggleCategory.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => (committedFilters.categoryId ? new Set([committedFilters.categoryId]) : new Set())
  );

  const [useCurrentLocation, setUseCurrentLocation] = useState(committedFilters.useMyLocation);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [deviceLat, setDeviceLat] = useState<number | undefined>(committedFilters.lat);
  const [deviceLng, setDeviceLng] = useState<number | undefined>(committedFilters.lng);
  const [state, setState] = useState<string | undefined>(committedFilters.state);
  const [city, setCity] = useState<string | undefined>(committedFilters.city);
  const [area, setArea] = useState<string | undefined>(committedFilters.area);
  // Only defer to a previously-committed value when a location filter was actually in play —
  // otherwise (fresh mount, no committed filters) this must default true, since it's not visible
  // until the location toggle is on and shouldn't count as an active filter on its own either way.
  const [applyRadius, setApplyRadius] = useState(
    committedFilters.useMyLocation ? committedFilters.searchWithin !== undefined : true
  );
  // Left blank (shows the "0.00" placeholder) until the user overrides it — an empty box still
  // means the default radius applies, matching the design's banner text ("within 5km") below it.
  const [radiusKm, setRadiusKm] = useState(committedFilters.searchWithin !== undefined ? String(committedFilters.searchWithin) : '');
  const effectiveRadiusKm = radiusKm || String(DEFAULT_NEARBY_RADIUS_KM);

  const [includeNew, setIncludeNew] = useState(committedFilters.conditionNew);
  const [includeNeatlyUsed, setIncludeNeatlyUsed] = useState(committedFilters.conditionNeatlyUsed);

  const [minPrice, setMinPrice] = useState(committedFilters.minPrice ?? PRICE_BOUND_MIN);
  const [maxPrice, setMaxPrice] = useState(committedFilters.maxPrice ?? PRICE_BOUND_MAX);

  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [nearbyCountLoading, setNearbyCountLoading] = useState(false);

  // Only meaningful once we actually have a point to count around — re-fires whenever the radius
  // (or the resolved coords) changes, debounced so typing into the radius field doesn't fire one
  // request per keystroke.
  useEffect(() => {
    // Banner isn't shown at all unless the toggle+radius are on — nothing to do.
    if (!(useCurrentLocation && applyRadius)) {
      setNearbyCount(null);
      setNearbyCountLoading(false);
      return;
    }

    // Toggle+radius are on, but getDeviceLocation() hasn't resolved yet — the banner is already
    // visible at this point (it renders as soon as the toggle is optimistically flipped on), so
    // it should read as loading here too, not drop to "—" while we wait on coords.
    if (deviceLat === undefined || deviceLng === undefined) {
      setNearbyCount(null);
      setNearbyCountLoading(true);
      return;
    }

    let cancelled = false;
    setNearbyCountLoading(true);
    const timer = setTimeout(() => {
      listingsApi
        .getListingsCount({ lat: deviceLat, lng: deviceLng, radiusKm: Number(effectiveRadiusKm) })
        .then((result) => {
          if (!cancelled) setNearbyCount(result.count);
        })
        .catch(() => {
          if (!cancelled) setNearbyCount(null);
        })
        .finally(() => {
          if (!cancelled) setNearbyCountLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [useCurrentLocation, applyRadius, deviceLat, deviceLng, effectiveRadiusKm]);

  // The exact shape handleShow() commits — memoized so the results effect below only re-fires
  // when something in it actually changed, not on every render.
  const draftFilters: SearchFilters = useMemo(
    () => ({
      categoryId: selectedCategoryIds.size > 0 ? Array.from(selectedCategoryIds)[0] : undefined,
      useMyLocation: useCurrentLocation,
      lat: useCurrentLocation ? deviceLat : undefined,
      lng: useCurrentLocation ? deviceLng : undefined,
      searchWithin: useCurrentLocation && applyRadius ? Number(effectiveRadiusKm) : undefined,
      state: !useCurrentLocation ? state : undefined,
      city: !useCurrentLocation ? city : undefined,
      area: !useCurrentLocation ? area : undefined,
      conditionNew: includeNew,
      conditionNeatlyUsed: includeNeatlyUsed,
      minPrice: minPrice !== PRICE_BOUND_MIN ? minPrice : undefined,
      maxPrice: maxPrice !== PRICE_BOUND_MAX ? maxPrice : undefined,
    }),
    [selectedCategoryIds, useCurrentLocation, deviceLat, deviceLng, applyRadius, effectiveRadiusKm, state, city, area, includeNew, includeNeatlyUsed, minPrice, maxPrice]
  );

  const [resultsTotal, setResultsTotal] = useState<number | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // No dedicated "count matching every filter" endpoint exists (the /listings/count above is
  // location-only) — GET /listings itself returns `total` in its paginated response, so a
  // page:1/limit:1 call doubles as a count. Every change to the draft filters (or the active
  // keyword) re-fires this, 3s debounced.
  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);
    const timer = setTimeout(() => {
      listingsApi
        .searchListings({ ...toListingSearchParams(draftFilters, keyword), page: 1, limit: 1 })
        .then((result) => {
          if (!cancelled) setResultsTotal(result.total);
        })
        .catch(() => {
          if (!cancelled) setResultsTotal(null);
        })
        .finally(() => {
          if (!cancelled) setResultsLoading(false);
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draftFilters, keyword]);

  const hasActiveFilters =
    selectedCategoryIds.size > 0 ||
    useCurrentLocation ||
    state !== undefined ||
    city !== undefined ||
    area !== undefined ||
    !applyRadius ||
    radiusKm !== '' ||
    !includeNew ||
    !includeNeatlyUsed ||
    minPrice !== PRICE_BOUND_MIN ||
    maxPrice !== PRICE_BOUND_MAX;

  const loadCategories = useCallback(async (page: number) => {
    if (page === 1) setCategoriesLoading(true);
    else setCategoriesLoadingMore(true);

    try {
      const data = await categoriesApi.getAllCategories({ page, limit: CATEGORY_PAGE_LIMIT });
      setCategories((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
      setCategoriesPage(page);
      setCategoriesHasMore(data.hasMore ?? page * CATEGORY_PAGE_LIMIT < data.total);
      setCategoriesError(null);
    } catch (e) {
      setCategoriesError(extractErrorMessage(e, 'Could not load categories.'));
    } finally {
      setCategoriesLoading(false);
      setCategoriesLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadCategories(1);
  }, [loadCategories]);

  // Tapping the active chip again clears it; tapping a different one replaces the selection —
  // the backend only accepts one categoryId, so the chips are effectively single-select.
  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
  }

  // getDeviceLocation() is async — if the toggle is flipped off again (or Reset fires) before it
  // resolves, a stale resolution must not be allowed to silently flip the toggle back on. Every
  // call bumps this and only the most recent one is allowed to apply its result.
  const locationRequestId = useRef(0);

  // Optimistic — the switch flips immediately instead of waiting on getDeviceLocation() (which
  // checks/prompts for permission itself), reverting back off only if that actually fails.
  function handleToggleCurrentLocation(next: boolean) {
    const requestId = ++locationRequestId.current;
    setUseCurrentLocation(next);
    if (!next) return;

    getDeviceLocation().then((device) => {
      if (locationRequestId.current !== requestId) return; // superseded by a later toggle/reset
      if (!device) {
        setUseCurrentLocation(false);
        showWarningToast('Location needed', 'Enable location access to search near you.');
        return;
      }
      setLocationLabel(device.label);
      setDeviceLat(device.lat);
      setDeviceLng(device.lng);
    });
  }

  function handleReset() {
    locationRequestId.current++; // invalidate any in-flight getDeviceLocation() from the toggle
    setSelectedCategoryIds(new Set());
    setUseCurrentLocation(false);
    setLocationLabel(null);
    setDeviceLat(undefined);
    setDeviceLng(undefined);
    setState(undefined);
    setCity(undefined);
    setArea(undefined);
    setApplyRadius(true);
    setRadiusKm('');
    setIncludeNew(true);
    setIncludeNeatlyUsed(true);
    setMinPrice(PRICE_BOUND_MIN);
    setMaxPrice(PRICE_BOUND_MAX);
  }

  function handleShow() {
    commitFilters(draftFilters);
    router.back();
  }

  // Only Lagos LGAs exist in this app's data today (see formOptions.ts) — City and Area both
  // fall back to that same placeholder list until a real per-state/city dataset exists.
  const localityOptions = getAreaOptions(state ?? 'Lagos');

  return (
    <ScreenContainer
      background={colors.white}
      header={
        <ScreenHeader
          title="Filter By"
          rightElement={
            <Pressable onPress={guard(handleReset)} hitSlop={8} disabled={!hasActiveFilters}>
              <Text style={[styles.resetText, !hasActiveFilters && styles.resetTextDisabled]}>Reset</Text>
            </Pressable>
          }
        />
      }
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.resultsPillText}>
            {resultsLoading ? 'Counting…' : resultsTotal !== null ? `${resultsTotal} Result${resultsTotal === 1 ? '' : 's'}` : 'No Results'}
          </Text>
          <Pressable onPress={guard(handleShow)} style={styles.showButton}>
            <Text style={styles.showButtonLabel}>Show</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sectionTitle}>Categories</Text>
      {categoriesLoading ? (
        <CategoryChipsSkeleton />
      ) : categoriesError ? (
        <Text style={styles.errorText}>{categoriesError}</Text>
      ) : (
        <View style={styles.chipWrap}>
          {categories.map((category) => {
            const selected = selectedCategoryIds.has(category.id);
            return (
              <Pressable
                key={category.id}
                onPress={guard(() => toggleCategory(category.id))}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category.title}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!categoriesLoading && categoriesHasMore ? (
        <Pressable
          onPress={guard(() => loadCategories(categoriesPage + 1))}
          style={styles.loadMoreButton}
          disabled={categoriesLoadingMore}
        >
          {categoriesLoadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>Load More</Text>
          )}
        </Pressable>
      ) : null}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Location</Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleRowText}>
          <Text style={styles.rowLabel}>Show items in your current location</Text>
          <Text style={styles.rowSubtitle}>When this is on, you'll see listings around you right now.</Text>
        </View>
        <Switch value={useCurrentLocation} onValueChange={handleToggleCurrentLocation} {...switchProps} />
      </View>

      {!useCurrentLocation ? (
        <>
          <Text style={styles.subheading}>Explore Locations</Text>
          <View style={styles.fieldGap}>
            <FormDropdown label="State" placeholder="Select--" data={NIGERIAN_STATE_OPTIONS} value={state} onChange={setState} />
          </View>
          <View style={styles.fieldGap}>
            <FormDropdown label="City" placeholder="Select--" data={localityOptions} value={city} onChange={setCity} />
          </View>
          <View style={styles.fieldGap}>
            <FormDropdown label="Area" placeholder="Select--" data={localityOptions} value={area} onChange={setArea} />
          </View>
        </>
      ) : (
        <View style={styles.toggleRow}>
          <Text style={styles.rowLabel}>Apply Radius</Text>
          <Switch value={applyRadius} onValueChange={setApplyRadius} {...switchProps} />
        </View>
      )}

      {useCurrentLocation && applyRadius ? (
        <>
          <View style={styles.radiusRow}>
            <Text style={styles.rowLabel}>Search within:</Text>
            <AmountField
              unitLabel="KM"
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Icon name="danger" variant="bold" size={verticalScale(16)} color={colors.white} />
            </View>
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>Showing results near {locationLabel ?? 'you'}</Text>
              <Text style={styles.infoBannerSubtitle}>
                {nearbyCountLoading ? 'Counting…' : nearbyCount !== null ? `${nearbyCount} item${nearbyCount === 1 ? '' : 's'}` : '—'} found
                within {effectiveRadiusKm}km
              </Text>
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Item Condition</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.rowLabel}>New</Text>
        <Switch value={includeNew} onValueChange={setIncludeNew} {...switchProps} />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.rowLabel}>Neatly used</Text>
        <Switch value={includeNeatlyUsed} onValueChange={setIncludeNeatlyUsed} {...switchProps} />
      </View>

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Price Range</Text>
      <PriceRangeSlider
        min={minPrice}
        max={maxPrice}
        bound={[PRICE_BOUND_MIN, PRICE_BOUND_MAX]}
        onChange={(nextMin, nextMax) => {
          setMinPrice(nextMin);
          setMaxPrice(nextMax);
        }}
      />

      <View style={styles.priceRow}>
        <Text style={styles.rowLabel}>Min</Text>
        <AmountField
          unitLabel="Naira"
          value={String(minPrice)}
          onChangeText={(text) => setMinPrice(clamp(Number(text) || 0, PRICE_BOUND_MIN, maxPrice))}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.rowLabel}>Max</Text>
        <AmountField
          unitLabel="Naira"
          value={String(maxPrice)}
          onChangeText={(text) => setMaxPrice(clamp(Number(text) || 0, minPrice, PRICE_BOUND_MAX))}
          keyboardType="number-pad"
        />
      </View>
    </ScreenContainer>
  );
}

// Varied widths so the placeholder row reads as text-shaped chips rather than uniform blocks.
const CATEGORY_SKELETON_WIDTHS = [72, 90, 64, 100, 80, 68, 96, 76];

/** Initial-load placeholder for the Categories chips — pulses like ListingCardSkeleton. */
function CategoryChipsSkeleton() {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.chipWrap, pulseStyle]}>
      {CATEGORY_SKELETON_WIDTHS.map((width, index) => (
        <View key={index} style={[styles.chipSkeletonBone, { width: verticalScale(width) }]} />
      ))}
    </Animated.View>
  );
}

interface PriceRangeSliderProps {
  min: number;
  max: number;
  bound: [number, number];
  onChange: (min: number, max: number) => void;
}

/** Custom dual-thumb slider — no range-slider package is installed, so this uses core PanResponder. */
function PriceRangeSlider({ min, max, bound, onChange }: PriceRangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [boundMin, boundMax] = bound;

  // PanResponder handlers below are created once via useRef, so they'd otherwise close over stale
  // min/max/trackWidth from the first render — this ref keeps them reading the latest values.
  const latest = useRef({ min, max, trackWidth });
  latest.current = { min, max, trackWidth };

  function valueToX(value: number) {
    const { trackWidth } = latest.current;
    if (trackWidth === 0) return 0;
    return ((value - boundMin) / (boundMax - boundMin)) * trackWidth;
  }

  function xToValue(x: number) {
    const { trackWidth } = latest.current;
    if (trackWidth === 0) return boundMin;
    const clampedX = clamp(x, 0, trackWidth);
    return Math.round(boundMin + (clampedX / trackWidth) * (boundMax - boundMin));
  }

  const minResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const { min, max } = latest.current;
        const nextValue = clamp(xToValue(valueToX(min) + gesture.dx), boundMin, max);
        onChange(nextValue, max);
      },
    })
  ).current;

  const maxResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const { min, max } = latest.current;
        const nextValue = clamp(xToValue(valueToX(max) + gesture.dx), min, boundMax);
        onChange(min, nextValue);
      },
    })
  ).current;

  const minX = valueToX(min);
  const maxX = valueToX(max);

  return (
    <View style={styles.sliderWrap} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <View style={styles.sliderTrackBase} />
      <View style={[styles.sliderTrackFill, { left: minX, width: Math.max(0, maxX - minX) }]} />
      <View style={[styles.sliderThumb, { left: minX - THUMB_SIZE / 2 }]} {...minResponder.panHandlers} />
      <View style={[styles.sliderThumb, { left: maxX - THUMB_SIZE / 2 }]} {...maxResponder.panHandlers} />
    </View>
  );
}

interface AmountFieldProps {
  unitLabel: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType: 'decimal-pad' | 'number-pad';
  placeholder?: string;
}

/** Unit pill + focus-highlighted box, matching AddItemPriceStep's price input treatment. */
function AmountField({ unitLabel, value, onChangeText, keyboardType, placeholder }: AmountFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.amountGroup}>
      <View style={styles.unitPill}>
        <Text style={styles.unitPillText}>{unitLabel}</Text>
      </View>
      <View style={[styles.amountInputWrap, focused && styles.amountInputWrapFocused]}>
        <TextInput
          style={styles.amountInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.gray300}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resetText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning,
  },
  resetTextDisabled: {
    color: colors.gray300,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  
  resultsPillText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  // Matches addItemModal's footer button treatment — fully rounded, not the shared Button's radius.lg.
  showButton: {
    flex: 1,
    minHeight: verticalScale(56),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.xl,
  },
  showButtonLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  subheading: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray700,
    marginTop: spacingY.sm,
    marginBottom: spacingY.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginHorizontal: -spacingX['2xl'],
    marginVertical: spacingY.xl,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingX.sm,
    marginBottom: spacingY.md,
  },
  chip: {
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.sm,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
  },
  chipTextSelected: {
    color: colors.white,
  },
  chipSkeletonBone: {
    height: verticalScale(34),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray200,
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingVertical: spacingY.sm,
    paddingHorizontal: spacingX.xl,
    marginBottom: spacingY.lg,
  },
  loadMoreText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    marginBottom: spacingY.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    marginBottom: spacingY.lg,
  },
  toggleRowText: {
    flex: 1,
    gap: verticalScale(2),
  },
  rowLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  rowSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  fieldGap: {
    marginBottom: spacingY.md,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.lg,
  },
  // Pill + focus-highlighted box — matches AddItemPriceStep's priceInputWrap treatment.
  amountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
  },
  amountInputWrap: {
    width: verticalScale(110),
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.sm,
  },
  amountInputWrapFocused: {
    borderColor: colors.primary,
  },
  amountInput: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.gray400,
    textAlign: 'right',
    padding: 0,
  },
  unitPill: {
    paddingHorizontal: spacingX.md,
    paddingVertical: spacingY.sm,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  unitPillText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacingX.md,
    marginBottom: spacingY.lg,
  },
  infoBannerIcon: {
    width: verticalScale(28),
    height: verticalScale(28),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerText: {
    flex: 1,
    gap: verticalScale(2),
  },
  infoBannerTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  infoBannerSubtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray500,
  },
  sliderWrap: {
    height: TRACK_WRAP_HEIGHT,
    marginBottom: spacingY.lg,
  },
  sliderTrackBase: {
    position: 'absolute',
    top: TRACK_TOP,
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
  },
  sliderTrackFill: {
    position: 'absolute',
    top: TRACK_TOP,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: 'absolute',
    top: THUMB_TOP,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
