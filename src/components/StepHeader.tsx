import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useSingleTap } from '@/hooks/useSingleTap';

interface StepHeaderProps {
  step: number;
  total: number;
  onBack?: () => void;
}

/** "‹  2 of 3" header used across the mandatory post-signup verification screens. */
export function StepHeader({ step, total, onBack }: StepHeaderProps) {
  const guard = useSingleTap();

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={guard(onBack)} hitSlop={12} style={styles.backButton}>
          <CaretLeft size={20} color={colors.gray700} />
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.gray100,
  },
  badgeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray600,
  },
});
