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
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { listingsApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/staleTimes';
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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

  // This is a modal (pushed fresh each time, unlike the old tab screen it replaced), so a
  // mount-only fetch is enough — no focus-effect re-fetch needed to catch searches saved elsewhere.
  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  // Clears the shared search context on the way out — on unmount rather than only from the header's
  // back button, so hardware back / swipe-to-dismiss (which skip handleBack entirely) are covered
  // too. Doesn't fire from onPressListing/goToFilter, since those push on top without unmounting
  // this screen — leaving here to refine the same search still works. setKeyword/setFilters are
  // stable useState setters and resetFilters always targets the same constant regardless of when
  // its closure was captured, so this is safe with an empty dependency array.
  useEffect(() => {
    return () => {
      setKeyword('');
      resetFilters();
    };
  }, []);

  // Drives the actual fetch below (stays debounced — filters combine with whatever keyword the
  // network call last committed to, never dropped or reset by typing).
  const hasActiveSearch = keyword.trim() !== '' || hasActiveFilters;
  // Drives which branch renders — reacts to `query` immediately so the results area (and its
  // skeleton) mounts the instant you type, instead of sitting on "Start typing…" for 500ms.
  const showResultsArea = query.trim() !== '' || hasActiveFilters;
  // True for the window between a keystroke and the debounce below actually committing it —
  // treated the same as network loading so typing never flashes an empty/"no results" state.
  const isPendingDebounce = query.trim() !== keyword.trim();

  const searchParams = toListingSearchParams(filters, keyword);
  const { items, total, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
    queryKeys.listings.searchInfinite(searchParams),
    ({ page, limit }) => listingsApi.searchListings({ ...searchParams, page, limit }),
    hasActiveSearch,
    STALE_TIME.BROWSE
  );
  // Text feedback ("Searching…") reacts to any pending state, including debounce.
  const isSearching = loading || refreshing || isPendingDebounce;
  // But the list itself only clears to empty for a genuine network fetch — a pending debounce
  // alone must never wipe results already on screen (e.g. a filtered list you're refining with a
  // keyword), or every keystroke flashes them away and back. Forcing the skeleton for a pending
  // debounce is still fine when there's nothing on screen yet to lose.
  const isFetching = loading || refreshing;
  const showSkeleton = isFetching || (isPendingDebounce && items.length === 0);

  // Fetch-as-you-type — 500ms after the user stops typing, the query becomes the active keyword
  // (which drives the search above via resetKey). Submit/leaving-to-filter below commit instantly
  // instead of waiting on this, since those are already deliberate, discrete actions.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === keyword.trim()) return;
    const timer = setTimeout(() => setKeyword(trimmed), 500);
    return () => clearTimeout(timer);
  }, [query, keyword, setKeyword]);

  // Only ever saved once a keyword's search actually comes back with results — never on
  // submit/keystroke alone. savedKeywordRef stops a re-save on every unrelated state change
  // (e.g. a filter tweak) for a keyword that's already been recorded.
  const savedKeywordRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || refreshing || error) return;
    const trimmed = keyword.trim();
    if (!trimmed || savedKeywordRef.current === trimmed) return;
    if (total !== null && total > 0) {
      savedKeywordRef.current = trimmed;
      addRecentSearch(trimmed).then(setRecentSearches);
    }
  }, [keyword, loading, refreshing, error, total]);

  function goToFilter() {
    // Typed-but-unsubmitted text would otherwise be silently dropped from the filtered results —
    // it's still sitting visibly in the box, so commit it as the active keyword before leaving.
    commitKeyword(query);
    router.push('/(modals)/filterByModal');
  }

  // Commits immediately, bypassing the debounce above — for deliberate actions (submit, leaving
  // to filter) that shouldn't wait an extra 300ms.
  function commitKeyword(term: string) {
    const trimmed = term.trim();
    setQuery(trimmed);
    setKeyword(trimmed);
  }

  function clearQuery() {
    setQuery('');
    setKeyword('');
  }

  function handleClearFilters() {
    resetFilters();
  }

  function goToRecentSearch(term: string) {
    commitKeyword(term);
  }

  async function handleClearRecent() {
    await clearRecentSearches();
    setRecentSearches([]);
  }

  function handleBack() {
    router.back();
  }

  function onPressListing(listing: Listing) {
    router.push({ pathname: '/(modals)/listingDetailsModal', params: { id: listing._id } });
  }

  const filterSummary = hasActiveFilters ? summarizeFilters(filters) : [];
  // Filtering only makes sense once there's something to filter — a typed query or an already-
  // resolved result set. Not gated on hasActiveFilters itself, since Clear should stay reachable.
  const canOpenFilter = query.trim() !== '' || (total !== null && total > 0);

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      scroll={false}
      style={{ paddingTop: 0 }}
      header={
        <>
          <ScreenHeader
            title="Search Result"
            onBack={guard(handleBack)}
            rightElement={
              <Pressable
                onPress={canOpenFilter ? guard(goToFilter) : undefined}
                disabled={!canOpenFilter}
                style={[styles.headerFilterButton, !canOpenFilter && styles.headerFilterButtonDisabled]}
                hitSlop={8}
              >
                <Icon name="setting-3" variant="bold" size={verticalScale(18)} color={canOpenFilter ? colors.gray700 : colors.gray300} />
              </Pressable>
            }
          />
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
                  onSubmitEditing={() => commitKeyword(query)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                {query.length > 0 ? (
                  <Pressable onPress={guard(clearQuery)} style={styles.clearButton} hitSlop={8}>
                    <Icons.XIcon size={verticalScale(12)} weight="bold" color={colors.white} />
                  </Pressable>
                ) : null}
              </View>
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

            {showResultsArea && (isSearching || total !== null) ? (
              <Text style={styles.resultsCountText}>
                {isSearching ? 'Searching…' : `${total} total result${total === 1 ? '' : 's'}`}
              </Text>
            ) : null}
          </View>
        </>
      }
    >
      {showResultsArea ? (
        <FlatList
          data={isFetching ? [] : items}
          keyExtractor={(item) => item._id}
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
            showSkeleton ? (
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
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <Pressable onPress={guard(handleClearRecent)} disabled={recentSearches.length === 0} hitSlop={8}>
              <Text style={[styles.clearLink, recentSearches.length === 0 && styles.clearLinkDisabled]}>CLEAR</Text>
            </Pressable>
          </View>

          {recentSearches.length === 0 ? (
            <EmptyState icon={Icons.MagnifyingGlassIcon} message="Your recent searches will show up here." />
          ) : (
            recentSearches.map((term) => (
              <Pressable key={term} onPress={guard(() => goToRecentSearch(term))} style={styles.searchRowItem}>
                <View style={styles.searchRowLeft}>
                  <Icons.MagnifyingGlassIcon size={verticalScale(18)} color={colors.gray400} />
                  <Text style={styles.searchRowText} numberOfLines={1}>
                    {term}
                  </Text>
                </View>
                <Icons.ArrowUpRightIcon size={verticalScale(18)} color={colors.primary} />
              </Pressable>
            ))
          )}
        </>
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
  // Sized to match BackButton on ScreenHeader's other side, not the 52px search-row button it replaced.
  headerFilterButton: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFilterButtonDisabled: {
    backgroundColor: colors.gray50,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  clearLink: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  clearLinkDisabled: {
    color: colors.gray300,
  },
  searchRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingX.md,
    paddingVertical: spacingY.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  searchRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
  },
  searchRowText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
});
