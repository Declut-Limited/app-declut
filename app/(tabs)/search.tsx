import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { EmptyState, ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { summarizeFilters, useSearchFilter } from '@/contexts/SearchFilterContext';

export default function SearchScreen() {
  const guard = useSingleTap();
  const { keyword, setKeyword, filters, hasActiveFilters, resetFilters } = useSearchFilter();

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  function goToResults() {
    router.push('/(modals)/searchResultsModal');
  }

  function goToFilter() {
    router.push('/(modals)/filterByModal');
  }

  async function goToRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setKeyword(trimmed);
    const next = await addRecentSearch(trimmed);
    setRecentSearches(next);
    router.push('/(modals)/searchResultsModal');
  }

  function handleClearFilters() {
    resetFilters();
  }

  async function handleClearRecent() {
    await clearRecentSearches();
    setRecentSearches([]);
  }

  const filterSummary = hasActiveFilters ? summarizeFilters(filters) : [];

  return (
    <ScreenContainer
      edges={['top']}
      background={colors.white}
      header={
        <>
          <ScreenHeader title="Search" showBack={false} />
          <View style={styles.searchRowWrap}>
            <View style={styles.searchRow}>
              <Pressable onPress={guard(goToResults)} style={styles.searchBar}>
                <Icon name="search-normal-1" variant="linear" size={verticalScale(18)} color={colors.gray400} />
                <Text style={styles.searchPlaceholder} numberOfLines={1}>
                  {keyword || 'What are you looking for?'}
                </Text>
              </Pressable>
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
  searchPlaceholder: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray400,
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
});
