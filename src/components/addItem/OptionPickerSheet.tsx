import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard } from '@/components';
import type { DropdownOption } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

const LIST_MAX_HEIGHT = verticalScale(435);

interface OptionPickerSheetProps {
  title: string;
  options: DropdownOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Category is backend-fetched (paginated); Condition/State/Area are static lists and never pass these. */
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Adds a filter box above the list — for long static lists (State/Area). Paginated remote lists (Category) don't use this, since filtering a page at a time wouldn't search the full set. */
  searchable?: boolean;
}

// Shared bottom-sheet picker for AddItemBasicInfoStep's Condition/State/Area/Category fields (and
// filterByModal's State/Area) — same row treatment throughout. Bounded + scrollable so longer lists
// (states, paginated categories) don't get clipped by BottomSheetCard's own maxHeight; short lists
// render under that bound with no scrollbar.
export function OptionPickerSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
  loading,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  searchable,
}: OptionPickerSheetProps) {
  const guard = useSingleTap();
  const [search, setSearch] = useState('');

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!searchable || !query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search, searchable]);

  // Some remote lists (e.g. banks) have duplicate `value`s — index keeps this unique regardless,
  // and is safe since this list's order never reshuffles in place.
  const keyExtractor = useCallback((option: DropdownOption, index: number) => `${option.value}-${index}`, []);

  const renderItem = useCallback(
    ({ item }: { item: DropdownOption }) => <OptionRow option={item} selected={item.value === value} onSelect={onSelect} />,
    [value, onSelect]
  );

  return (
    <BottomSheetCard onBackdropPress={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={guard(onClose)} style={styles.closeButton} hitSlop={8}>
          <Icons.XIcon size={verticalScale(18)} color={colors.gray700} weight="bold" />
        </Pressable>
      </View>

      {searchable ? (
        <View style={styles.searchBox}>
          <Icons.MagnifyingGlassIcon size={verticalScale(18)} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${title.toLowerCase()}…`}
            placeholderTextColor={colors.gray400}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={guard(() => setSearch(''))} hitSlop={8}>
              <Icons.XCircleIcon size={verticalScale(18)} color={colors.gray300} weight="fill" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={visibleOptions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Long static lists (State's 37 entries, Bank's ~30+ each with a logo image) don't need
          // to mount every row up front — virtualizing is what actually fixes the slow-open/janky-
          // scroll feel a plain ScrollView had here, on top of expo-image's own disk cache below.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.emptyText}>No matches found.</Text>}
          ListFooterComponent={
            hasMore ? (
              <Pressable onPress={guard(() => onLoadMore?.())} style={styles.loadMoreButton} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.loadMoreText}>Load More</Text>}
              </Pressable>
            ) : null
          }
        />
      )}
    </BottomSheetCard>
  );
}

interface OptionRowProps {
  option: DropdownOption;
  selected: boolean;
  onSelect: (value: string) => void;
}

// Extracted + memoized so scrolling (and the parent's own re-renders while a search query is being
// typed) doesn't re-render every row — only the ones whose `selected`/`option` actually changed.
const OptionRow = React.memo(function OptionRow({ option, selected, onSelect }: OptionRowProps) {
  const guard = useSingleTap();

  return (
    <Pressable
      onPress={guard(() => onSelect(option.value))}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.optionMain}>
        {option.imageUrl ? (
          <View style={styles.optionImageWrap}>
            <Image source={{ uri: option.imageUrl }} style={styles.optionImage} contentFit="cover" cachePolicy="memory-disk" />
          </View>
        ) : null}
        <Text style={styles.optionLabel}>{option.label}</Text>
      </View>
      {selected ? (
        <View style={styles.checkCircle}>
          <Icons.CheckIcon size={verticalScale(11)} color={colors.white} weight="bold" />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  header: {
    marginBottom: spacingY.lg,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    minHeight: verticalScale(48),
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.gray100,
    paddingHorizontal: spacingX.md,
    marginBottom: spacingY.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.ink,
    padding: 0,
  },
  emptyText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
    paddingVertical: spacingY.xl,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -verticalScale(4),
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: LIST_MAX_HEIGHT,
  },
  loadingIndicator: {
    paddingVertical: spacingY.xl,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: spacingY.xl,
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingVertical: spacingY.sm,
    paddingHorizontal: spacingX.xl,
    marginTop: spacingY.xs,
    marginBottom: spacingY.sm,
  },
  loadMoreText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.sm,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.sm,
    flex: 1,
  },
  // Shows through while the remote logo is still fetching — Image itself is transparent until
  // it has data, so without this the row looks blank rather than "loading".
  optionImageWrap: {
    width: verticalScale(28),
    height: verticalScale(28),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  optionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray700,
  },
  checkCircle: {
    width: verticalScale(20),
    height: verticalScale(20),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
