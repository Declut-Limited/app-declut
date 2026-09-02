import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCard, ListingCardSkeleton, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { addRecentSearch } from '@/lib/recentSearches';
import { listingsApi } from '@/api';
import type { Listing } from '@/api/types';
import { summarizeFilters, toListingSearchParams, useSearchFilter } from '@/contexts/SearchFilterContext';

const SKELETON_COUNT = 6;

export default function SearchResultsModal() {
  const guard = useSingleTap();
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);
  const { keyword, setKeyword, filters, hasActiveFilters, resetFilters } = useSearchFilter();

  const [query, setQuery] = useState(keyword);
  const [focused, setFocused] = useState(false);

  // InteractionManager doesn't track the native modal's own slide-up transition (only JS-thread
  // interaction handles), so .focus() called that way still races it and gets silently dropped —
  // 'transitionEnd' is the event that actually fires once the native animation finishes.
  useEffect(() => {
    // 'transitionEnd' isn't in the base navigation event map typing (it's native-stack-specific).
    const unsubscribe = (navigation as { addListener: typeof navigation.addListener }).addListener(
      'transitionEnd' as never,
      () => inputRef.current?.focus()
    );
    return unsubscribe;
  }, [navigation]);

  const hasActiveSearch = keyword.trim() !== '' || hasActiveFilters;

  const { items, total, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    ({ page, limit }) => listingsApi.searchListings({ ...toListingSearchParams(filters, keyword), page, limit }),
    hasActiveSearch,
    `${keyword}|${JSON.stringify(filters)}`
  );

  function goToFilter() {
    // Typed-but-unsubmitted text would otherwise be silently dropped from the filtered results —
    // it's still sitting visibly in the box, so commit it as the active keyword before leaving.
    const trimmed = query.trim();
    if (trimmed && trimmed !== keyword) commitSearch(trimmed);
    router.push('/(modals)/filterByModal');
  }

  // A "search" is only ever recorded here (submit) — never on keystroke.
  async function commitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setKeyword(trimmed);
    await addRecentSearch(trimmed);
  }

  function clearQuery() {
    setQuery('');
    setKeyword('');
  }

  function handleClearFilters() {
    resetFilters();
  }

  function handleBack() {
    setQuery('');
    setKeyword('');
    resetFilters();
    router.back();
  }

  function onPressListing(listing: Listing) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: listing._id } });
  }

  const filterSummary = hasActiveFilters ? summarizeFilters(filters) : [];

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      scroll={false}
      style={{ paddingTop: 0 }}
      header={
        <>
          <ScreenHeader title="Search Result" onBack={guard(handleBack)} />
          <View style={styles.searchRowWrap}>
            <View style={styles.searchRow}>
              <View style={[styles.searchBar, focused && styles.searchBarActive]}>
                <Icon name="search-normal-1" variant="linear" size={verticalScale(18)} color={colors.gray400} />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="What are you looking for?"
                  placeholderTextColor={colors.gray400}
                  returnKeyType="search"
                  onSubmitEditing={() => commitSearch(query)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                {query.length > 0 ? (
                  <Pressable onPress={guard(clearQuery)} style={styles.clearButton} hitSlop={8}>
                    <Icons.XIcon size={verticalScale(12)} weight="bold" color={colors.white} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable onPress={guard(goToFilter)} style={styles.filterButton} hitSlop={8}>
                <Icon name="setting-3" variant="bold" size={verticalScale(20)} color={colors.gray700} />
              </Pressable>
            </View>

            {filterSummary.length > 0 ? (
              <View style={styles.activeFiltersRow}>
                <Text style={styles.activeFiltersText} numberOfLines={1}>
                  {filterSummary.join(' • ')}
                </Text>
                <Pressable onPress={guard(handleClearFilters)} hitSlop={8}>
                  <Text style={styles.clearFiltersText}>Clear</Text>
                </Pressable>
              </View>
            ) : null}

            {hasActiveSearch && (loading || refreshing || total !== null) ? (
              <Text style={styles.resultsCountText}>
                {loading || refreshing ? 'Searching…' : `${total} total result${total === 1 ? '' : 's'}`}
              </Text>
            ) : null}
          </View>
        </>
      }
    >
      {hasActiveSearch ? (
        <FlatList
          data={loading || refreshing ? [] : items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70)}>
              <ListingCard
                listing={item}
                userLat={filters.useMyLocation ? filters.lat : undefined}
                userLng={filters.useMyLocation ? filters.lng : undefined}
                onPress={() => onPressListing(item)}
              />
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading || refreshing ? (
              <ListingCardSkeleton count={SKELETON_COUNT} />
            ) : error ? (
              <Text style={styles.message}>{error}</Text>
            ) : (
              <EmptyState icon={Icons.MagnifyingGlassIcon} message="No results found." />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
        />
      ) : (
        <EmptyState icon={Icons.MagnifyingGlassIcon} message="Start typing to search for items." />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchRowWrap: {
    paddingHorizontal: spacingX['2xl'],
    paddingTop: spacingY.lg,
    paddingBottom: spacingY.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    marginTop: spacingY.md,
  },
  activeFiltersText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  clearFiltersText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning,
  },
  resultsCountText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.gray400,
    marginTop: spacingY.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    minHeight: verticalScale(52),
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacingX.lg,
  },
  searchBarActive: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.ink,
    paddingVertical: spacingY.md,
  },
  clearButton: {
    width: verticalScale(22),
    height: verticalScale(22),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: verticalScale(52),
    height: verticalScale(52),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
