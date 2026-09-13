import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { OptionPickerSheet } from '@/components/addItem/OptionPickerSheet';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { listingsApi } from '@/api';
import { useCategories } from '@/hooks/queries/useCategories';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';
import { formatNumber } from '@/utils/helpers';
import { showWarningToast } from '@/lib/toast';
import { toListingSearchParams, useSearchFilter } from '@/contexts/SearchFilterContext';
import type { SearchFilters } from '@/contexts/SearchFilterContext';

// No listings-count-by-filter endpoint exists yet — Price Range just needs sane outer bounds for the slider.
const PRICE_BOUND_MIN = 100;
const PRICE_BOUND_MAX = 100_000_000;

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

  const {
    categories,
    loading: categoriesLoading,
    loadingMore: categoriesLoadingMore,
    error: categoriesError,
    hasMore: categoriesHasMore,
    loadMore: loadMoreCategories,
  } = useCategories();
  // The backend only takes a single categoryId, so this is effectively single-select — see toggleCategory.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => (committedFilters.categoryId ? new Set([committedFilters.categoryId]) : new Set())
  );

  const [useCurrentLocation, setUseCurrentLocation] = useState(committedFilters.useMyLocation);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [deviceLat, setDeviceLat] = useState<number | undefined>(committedFilters.lat);
  const [deviceLng, setDeviceLng] = useState<number | undefined>(committedFilters.lng);
  const [state, setState] = useState<string | undefined>(committedFilters.state);
  const [area, setArea] = useState<string | undefined>(committedFilters.area);
  const [activeSheet, setActiveSheet] = useState<'state' | 'area' | null>(null);
  // Off by default (unlimited distance) — only defer to a previously-committed value when a
  // location filter was actually in play.
  const [applyRadius, setApplyRadius] = useState(
    committedFilters.useMyLocation ? committedFilters.searchWithin !== undefined : false
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
      categoryName: selectedCategoryIds.size > 0 ? categories.find((c) => c.id === Array.from(selectedCategoryIds)[0])?.title : undefined,
      useMyLocation: useCurrentLocation,
      lat: useCurrentLocation ? deviceLat : undefined,
      lng: useCurrentLocation ? deviceLng : undefined,
      // Sent whenever location is on, whether or not Apply Radius is — effectiveRadiusKm already
      // falls back to the 5km default in the background when the field is blank/untouched.
      // Never sent when location is off, regardless of what's left in the field.
      searchWithin: useCurrentLocation ? Number(effectiveRadiusKm) : undefined,
      state: !useCurrentLocation ? state : undefined,
      area: !useCurrentLocation ? area : undefined,
      conditionNew: includeNew,
      conditionNeatlyUsed: includeNeatlyUsed,
      minPrice: minPrice !== PRICE_BOUND_MIN ? minPrice : undefined,
      maxPrice: maxPrice !== PRICE_BOUND_MAX ? maxPrice : undefined,
    }),
    [selectedCategoryIds, categories, useCurrentLocation, deviceLat, deviceLng, applyRadius, effectiveRadiusKm, state, area, includeNew, includeNeatlyUsed, minPrice, maxPrice]
  );

  const [resultsTotal, setResultsTotal] = useState<number | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // applyRadius isn't included here — it's only visible/meaningful once useCurrentLocation is on,
  // which is already covered below, so it can't be "active" independently of that.
  const hasActiveFilters =
    selectedCategoryIds.size > 0 ||
    useCurrentLocation ||
    state !== undefined ||
    area !== undefined ||
    radiusKm !== '' ||
    includeNew ||
    includeNeatlyUsed ||
    minPrice !== PRICE_BOUND_MIN ||
    maxPrice !== PRICE_BOUND_MAX;

  // No dedicated "count matching every filter" endpoint exists (the /listings/count above is
  // location-only) — GET /listings itself returns `total` in its paginated response, so a
  // page:1/limit:1 call doubles as a count. Every change to the draft filters (or the active
  // keyword) re-fires this, 3s debounced.
  useEffect(() => {
    // Nothing to count with no filter set — skip the request entirely and just read as "No Result".
    if (!hasActiveFilters) {
      setResultsTotal(null);
      setResultsLoading(false);
      return;
    }

    // The location toggle flips on optimistically, before getDeviceLocation() resolves — firing
    // now would send useMyLocation=true with no lat/lng, which the endpoint requires together.
    // Wait for coords instead of sending (and counting) a request that's missing them.
    if (useCurrentLocation && (deviceLat === undefined || deviceLng === undefined)) {
      setResultsLoading(true);
      return;
    }

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
  }, [draftFilters, keyword, hasActiveFilters]);

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

  // Turning Apply Radius on gives the field a genuinely visible "5" rather than leaving it on an
  // empty "0.00" placeholder that silently defaults to 5 in the background.
  function handleToggleApplyRadius(next: boolean) {
    setApplyRadius(next);
    if (next && radiusKm === '') {
      setRadiusKm(String(DEFAULT_NEARBY_RADIUS_KM));
    }
  }

  function handleReset() {
    locationRequestId.current++; // invalidate any in-flight getDeviceLocation() from the toggle
    setSelectedCategoryIds(new Set());
    setUseCurrentLocation(false);
    setLocationLabel(null);
    setDeviceLat(undefined);
    setDeviceLng(undefined);
    setState(undefined);
    setArea(undefined);
    setApplyRadius(false);
    setRadiusKm('');
    setIncludeNew(false);
    setIncludeNeatlyUsed(false);
    setMinPrice(PRICE_BOUND_MIN);
    setMaxPrice(PRICE_BOUND_MAX);
  }

  function handleShow() {
    commitFilters(draftFilters);
    router.replace('/(modals)/searchResultsModal');
  }

  function handleSelectState(value: string) {
    setState(value);
    setArea(undefined); // areas are state-dependent — clear a now-invalid selection
    setActiveSheet(null);
  }

  // Only Lagos LGAs exist in this app's data today (see formOptions.ts) — falls back to that same
  // placeholder list until a real per-state dataset exists.
  const areaOptions = getAreaOptions(state ?? 'Lagos');

  return (
    <View style={styles.flex}>
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
              {!hasActiveFilters
                ? 'No Result'
                : resultsLoading
                ? 'Counting…'
                : resultsTotal !== null
                ? `${resultsTotal} Result${resultsTotal === 1 ? '' : 's'}`
                : 'No Results'}
            </Text>
            <Pressable
              onPress={guard(handleShow)}
              disabled={!hasActiveFilters}
              style={[styles.showButton, !hasActiveFilters && styles.showButtonDisabled]}
            >
              <Text style={[styles.showButtonLabel, !hasActiveFilters && styles.showButtonLabelDisabled]}>Show</Text>
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
          onPress={guard(loadMoreCategories)}
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
            <LocationPickerField label="State" placeholder="Select a state" value={state} onPress={() => setActiveSheet('state')} />
          </View>
          <View style={styles.fieldGap}>
            <LocationPickerField
              label="Area"
              placeholder={state ? 'Select an area' : 'Select a state first'}
              value={area}
              onPress={() => setActiveSheet('area')}
              disabled={!state}
            />
          </View>
        </>
      ) : (
        <View style={styles.toggleRow}>
          <Text style={styles.rowLabel}>Apply Radius</Text>
          <Switch value={applyRadius} onValueChange={handleToggleApplyRadius} {...switchProps} />
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
          value={formatNumber(minPrice)}
          onChangeText={(text) => setMinPrice(clamp(Number(text.replace(/[^0-9]/g, '')) || 0, PRICE_BOUND_MIN, maxPrice))}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.rowLabel}>Max</Text>
        <AmountField
          unitLabel="Naira"
          value={formatNumber(maxPrice)}
          onChangeText={(text) => setMaxPrice(clamp(Number(text.replace(/[^0-9]/g, '')) || 0, minPrice, PRICE_BOUND_MAX))}
          keyboardType="number-pad"
        />
      </View>
      </ScreenContainer>

      {activeSheet ? (
        <View style={StyleSheet.absoluteFill}>
          {activeSheet === 'state' ? (
            <OptionPickerSheet
              title="Select state"
              options={NIGERIAN_STATE_OPTIONS}
              value={state ?? ''}
              onSelect={handleSelectState}
              onClose={() => setActiveSheet(null)}
              searchable
            />
          ) : (
            <OptionPickerSheet
              title="Select area"
              options={areaOptions}
              value={area ?? ''}
              onSelect={(value) => {
                setArea(value);
                setActiveSheet(null);
              }}
              onClose={() => setActiveSheet(null)}
              searchable
            />
          )}
        </View>
      ) : null}
    </View>
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

const THUMB_HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 };

/** Custom dual-thumb slider — no range-slider package is installed, so this uses core PanResponder. */
function PriceRangeSlider({ min, max, bound, onChange }: PriceRangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [boundMin, boundMax] = bound;

  // PanResponder handlers below are created once via useRef, so they'd otherwise close over stale
  // min/max/trackWidth from the first render — this ref keeps them reading the latest values.
  const latest = useRef({ min, max, trackWidth });
  latest.current = { min, max, trackWidth };

  // gesture.dx is cumulative from wherever the touch started, not a per-move delta — so the
  // starting pixel position has to be captured once (on grant) and reused for the whole gesture.
  // Recomputing it from the live `min`/`max` on every move (as this used to) double-counts motion,
  // since those props are themselves changing mid-drag — that's what made the thumb feel erratic.
  const dragStartX = useRef(0);

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
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Refuse to hand the gesture back to an ancestor ScrollView mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartX.current = valueToX(latest.current.min);
      },
      onPanResponderMove: (_, gesture) => {
        const { max } = latest.current;
        const nextValue = clamp(xToValue(dragStartX.current + gesture.dx), boundMin, max);
        onChange(nextValue, max);
      },
    })
  ).current;

  const maxResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartX.current = valueToX(latest.current.max);
      },
      onPanResponderMove: (_, gesture) => {
        const { min } = latest.current;
        const nextValue = clamp(xToValue(dragStartX.current + gesture.dx), min, boundMax);
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
      <View style={[styles.sliderThumb, { left: minX - THUMB_SIZE / 2 }]} hitSlop={THUMB_HIT_SLOP} {...minResponder.panHandlers} />
      <View style={[styles.sliderThumb, { left: maxX - THUMB_SIZE / 2 }]} hitSlop={THUMB_HIT_SLOP} {...maxResponder.panHandlers} />
    </View>
  );
}

interface LocationPickerFieldProps {
  label: string;
  placeholder: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
}

// Bottom-sheet trigger field — same look/behavior as AddItemBasicInfoStep's LabeledPicker (label
// inside a gray box, above the value/placeholder, chevron on the right), opening OptionPickerSheet
// instead of the old inline FormDropdown menu.
function LocationPickerField({ label, placeholder, value, onPress, disabled }: LocationPickerFieldProps) {
  const guard = useSingleTap();

  return (
    <Pressable
      onPress={guard(onPress)}
      disabled={disabled}
      style={[styles.locationFieldBox, disabled && styles.locationFieldBoxDisabled]}
      accessibilityState={{ disabled }}
    >
      <View style={styles.locationFieldTextColumn}>
        <Text style={styles.locationFieldLabel}>{label}</Text>
        <Text style={[styles.locationFieldValue, !value && styles.locationFieldValuePlaceholder]}>{value || placeholder}</Text>
      </View>
      <Icon name="arrow-down-2" variant="linear" size={verticalScale(16)} color={disabled ? colors.gray300 : colors.gray400} />
    </Pressable>
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
  flex: {
    flex: 1,
  },
  locationFieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.sm,
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: spacingX.md,
  },
  locationFieldBoxDisabled: {
    opacity: 0.6,
  },
  locationFieldTextColumn: {
    flex: 1,
  },
  locationFieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray700,
    marginBottom: verticalScale(2),
  },
  locationFieldValue: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  locationFieldValuePlaceholder: {
    color: colors.gray400,
  },
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
  showButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  showButtonLabelDisabled: {
    color: colors.gray400,
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
