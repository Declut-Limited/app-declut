import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import { ScreenContainer, ScreenHeader } from '@/components';
import Icon from '@/components/Icon';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';

export default function SearchScreen() {
  const guard = useSingleTap();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  function goToFilter() {
    router.push('/(modals)/filterByModal');
  }

  // A "search" is only ever recorded here (submit / tapping a recent entry) — never on keystroke.
  async function commitSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    const next = await addRecentSearch(trimmed);
    setRecentSearches(next);
  }

  async function handleClearRecent() {
    await clearRecentSearches();
    setRecentSearches([]);
  }

  return (
    <ScreenContainer edges={['top']} background={colors.white} header={<ScreenHeader title="Search" showBack={false} />}>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Icon name="search-normal-1" variant="linear" size={verticalScale(18)} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="What are you looking for?"
            placeholderTextColor={colors.gray400}
            returnKeyType="search"
            onSubmitEditing={() => commitSearch(query)}
          />
          {query.length > 0 ? (
            <Pressable onPress={guard(() => setQuery(''))} style={styles.clearButton} hitSlop={8}>
              <Icons.XIcon size={verticalScale(12)} weight="bold" color={colors.white} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={guard(goToFilter)} style={styles.filterButton} hitSlop={8}>
          <Icon name="setting-3" variant="bold" size={verticalScale(26)} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        <Pressable onPress={guard(handleClearRecent)} disabled={recentSearches.length === 0}>
          <Text style={[styles.clearLink, recentSearches.length === 0 && styles.clearLinkDisabled]}>CLEAR</Text>
        </Pressable>
      </View>

      {recentSearches.length === 0 ? (
        <Text style={styles.emptyText}>Your recent searches will show up here.</Text>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
    marginBottom: spacingY['2xl'],
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
  emptyText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
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
