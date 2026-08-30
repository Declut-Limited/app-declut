import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { StepHeaderProps } from '@/utils/types';

/** "‹  2 of 3" header used across the mandatory post-signup verification screens. */
export function StepHeader({ step, total, onBack }: StepHeaderProps) {
  const guard = useSingleTap();

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={guard(onBack)} hitSlop={12} style={styles.backButton}>
          <Icons.CaretLeftIcon size={verticalScale(20)} color={colors.gray700} />
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {step} of {total}
        </Text>
      </View>
      <View style={styles.backButtonPlaceholder} />
    </View>
  );
}

const BUTTON_SIZE = verticalScale(36);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY.xl,
  },
  backButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  badge: {
    paddingVertical: spacingY.xs,
    paddingHorizontal: spacingX.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
  },
  badgeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray600,
  },
});
