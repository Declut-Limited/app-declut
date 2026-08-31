import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, FormDropdown, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { categoriesApi } from '@/api';
import { extractErrorMessage } from '@/api/client';
import type { Category } from '@/api/types';
import { DEFAULT_NEARBY_RADIUS_KM, getDeviceLocation } from '@/lib/location';
import { NIGERIAN_STATE_OPTIONS, getAreaOptions } from '@/constants/formOptions';

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
};

function clamp(value: number, lo: number, hi: number) {
  return Math.min(Math.max(value, lo), hi);
}

// FULL-SCREEN "FILTER BY" MODAL — triggered from Home's search-bar filter button.
export default function FilterByModal() {
  const guard = useSingleTap();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [categoriesHasMore, setCategoriesHasMore] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadingMore, setCategoriesLoadingMore] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<Set<string>>(new Set());

  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [state, setState] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [area, setArea] = useState<string | undefined>(undefined);
  const [applyRadius, setApplyRadius] = useState(true);
  // Left blank (shows the "0.00" placeholder) until the user overrides it — an empty box still
  // means the default radius applies, matching the design's banner text ("within 5km") below it.
  const [radiusKm, setRadiusKm] = useState('');
  const effectiveRadiusKm = radiusKm || String(DEFAULT_NEARBY_RADIUS_KM);

  const [includeNew, setIncludeNew] = useState(true);
  const [includeNeatlyUsed, setIncludeNeatlyUsed] = useState(true);

  const [minPrice, setMinPrice] = useState(PRICE_BOUND_MIN);
  const [maxPrice, setMaxPrice] = useState(PRICE_BOUND_MAX);

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

  useEffect(() => {
    getDeviceLocation().then((device) => {
      if (device) setLocationLabel(device.label);
    });
  }, []);

  function toggleCategory(slug: string) {
    setSelectedCategorySlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function handleReset() {
    setSelectedCategorySlugs(new Set());
    setUseCurrentLocation(false);
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
    // No search-results screen is wired up yet — this just closes the modal for now.
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
            <Pressable onPress={guard(handleReset)} hitSlop={8}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          }
        />
      }
      footer={
        <View style={styles.footerRow}>
          <View style={styles.resultsPill}>
            <Text style={styles.resultsPillText}>— Results</Text>
          </View>
          <View style={styles.showButtonWrap}>
            <Button label="Show" onPress={guard(handleShow)} />
          </View>
        </View>
      }
    >
      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={styles.chipWrap}>
        {categories.map((category) => {
          const selected = selectedCategorySlugs.has(category.slug);
          return (
            <Pressable
              key={category.id}
              onPress={guard(() => toggleCategory(category.slug))}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category.title}</Text>
            </Pressable>
          );
        })}
      </View>

      {categoriesLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.categoriesLoading} />
      ) : categoriesError ? (
        <Text style={styles.errorText}>{categoriesError}</Text>
      ) : null}

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
        <Switch value={useCurrentLocation} onValueChange={setUseCurrentLocation} {...switchProps} />
      </View>

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

      <View style={styles.toggleRow}>
        <Text style={styles.rowLabel}>Apply Radius</Text>
        <Switch value={applyRadius} onValueChange={setApplyRadius} {...switchProps} />
      </View>

      {applyRadius ? (
        <>
          <View style={styles.radiusRow}>
            <Text style={styles.rowLabel}>Search within:</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.radiusInput}
                value={radiusKm}
                onChangeText={setRadiusKm}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.gray300}
              />
              <View style={styles.unitPill}>
                <Text style={styles.unitPillText}>KM</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Icon name="danger" variant="bold" size={verticalScale(16)} color={colors.white} />
            </View>
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>Showing results near {locationLabel ?? 'you'}</Text>
              <Text style={styles.infoBannerSubtitle}>— items found within {effectiveRadiusKm}km</Text>
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
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.priceInput}
            value={String(minPrice)}
            onChangeText={(text) => setMinPrice(clamp(Number(text) || 0, PRICE_BOUND_MIN, maxPrice))}
            keyboardType="number-pad"
          />
          <View style={styles.unitPill}>
            <Text style={styles.unitPillText}>Naira</Text>
          </View>
        </View>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.rowLabel}>Max</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.priceInput}
            value={String(maxPrice)}
            onChangeText={(text) => setMaxPrice(clamp(Number(text) || 0, minPrice, PRICE_BOUND_MAX))}
            keyboardType="number-pad"
          />
          <View style={styles.unitPill}>
            <Text style={styles.unitPillText}>Naira</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
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

const styles = StyleSheet.create({
  resetText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.warning,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    paddingBottom: spacingY.md,
  },
  resultsPill: {
    paddingHorizontal: spacingX.lg,
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
  showButtonWrap: {
    flex: 1,
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
  categoriesLoading: {
    marginVertical: spacingY.lg,
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
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
  },
  radiusInput: {
    width: verticalScale(90),
    minHeight: verticalScale(44),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacingX.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
    textAlign: 'right',
  },
  priceInput: {
    width: verticalScale(120),
    minHeight: verticalScale(44),
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacingX.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray900,
    textAlign: 'right',
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
