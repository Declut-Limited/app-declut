import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { BottomSheetCard } from '@/components';
import type { DropdownOption } from '@/constants/formOptions';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';

const LIST_MAX_HEIGHT = verticalScale(420);

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
}

// Shared bottom-sheet picker for AddItemBasicInfoStep's Condition/State/Area/Category fields — same
// row treatment throughout. Bounded + scrollable so longer lists (states, paginated categories)
// don't get clipped by BottomSheetCard's own maxHeight; short lists render under that bound with no scrollbar.
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
}: OptionPickerSheetProps) {
  const guard = useSingleTap();

  return (
    <BottomSheetCard onBackdropPress={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={guard(onClose)} style={styles.closeButton} hitSlop={8}>
          <Icons.XIcon size={verticalScale(18)} color={colors.gray700} weight="bold" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={guard(() => onSelect(option.value))}
                style={[styles.option, selected && styles.optionSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                {selected ? (
                  <View style={styles.checkCircle}>
                    <Icons.CheckIcon size={verticalScale(11)} color={colors.white} weight="bold" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {hasMore ? (
            <Pressable onPress={guard(() => onLoadMore?.())} style={styles.loadMoreButton} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.loadMoreText}>Load More</Text>}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </BottomSheetCard>
  );
}

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
    paddingHorizontal: spacingX.lg,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
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
