import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ListingCard, ListingCardSkeleton, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { usePaginatedListings } from '@/hooks/usePaginatedListings';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { listingsApi } from '@/api';
import { summarizeFilters, toListingSearchParams, useSearchFilter } from '@/contexts/SearchFilterContext';
import { showWarningToast } from '@/lib/toast';

const SKELETON_COUNT = 6;

export default function SearchScreen() {
  const guard = useSingleTap();
  const inputRef = useRef<TextInput>(null);
  const { keyword, setKeyword, filters, hasActiveFilters, resetFilters } = useSearchFilter();
  const { favoriteIds, toggleFavorite } = useFavoriteToggle();

  const [query, setQuery] = useState(keyword);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  // Tabs stay mounted, so a mount-only effect wouldn't refocus on returning to this tab.
  useFocusEffect(
    useCallback(() => {
      inputRef.current?.focus();
    }, [])
  );

  const hasActiveSearch = keyword.trim() !== '' || hasActiveFilters;

  const { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh } = usePaginatedListings(
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

  // A "search" is only ever recorded here (submit / tapping a recent entry) — never on keystroke.
  async function commitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setKeyword(trimmed);
    const next = await addRecentSearch(trimmed);
    setRecentSearches(next);
  }

  function clearQuery() {
    setQuery('');
    setKeyword('');
  }

  function handleClearFilters() {
    resetFilters();
  }

  async function handleClearRecent() {
    await clearRecentSearches();
    setRecentSearches([]);
  }

  function onPressListing() {
    // No listing detail screen yet — nothing to navigate to.
    showWarningToast('Coming soon', "Listing details aren't built yet.");
  }

  const filterSummary = hasActiveFilters ? summarizeFilters(filters) : [];

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      scroll={!hasActiveSearch}
      avoidKeyboard={false}
      header={
        <>
          <ScreenHeader title="Search" showBack={false} />
          <View style={styles.searchRowWrap}>
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
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
          </View>
        </>
      }
    >
      {hasActiveSearch ? (
        <FlatList
          data={loading || refreshing ? [] : items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70)}>
              <ListingCard
                listing={item}
                userLat={filters.useMyLocation ? filters.lat : undefined}
                userLng={filters.useMyLocation ? filters.lng : undefined}
                onPress={onPressListing}
                showFavorite
                favorited={favoriteIds.has(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.white} />}
          onEndReachedThreshold={0.4}
          onEndReached={hasMore ? loadMore : undefined}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading || refreshing ? (
              <ListingCardSkeleton count={SKELETON_COUNT} variant="recent" />
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
            <Pressable onPress={guard(handleClearRecent)} disabled={recentSearches.length === 0}>
              <Text style={[styles.clearLink, recentSearches.length === 0 && styles.clearLinkDisabled]}>CLEAR</Text>
            </Pressable>
          </View>

          {recentSearches.length === 0 ? (
            <EmptyState icon={Icons.MagnifyingGlassIcon} message="Your recent searches will show up here." />
          ) : (
            recentSearches.map((term) => (
              <Pressable key={term} onPress={guard(() => commitSearch(term))} style={styles.searchRowItem}>
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
  // Matches filterByModal's Reset text treatment.
  clearFiltersText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.warning,
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
    paddingHorizontal: spacingX.lg,
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
