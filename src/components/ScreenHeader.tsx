import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from './BackButton';
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { ScreenHeaderProps } from '@/utils/types';

const SIDE_WIDTH = verticalScale(40);

/**
 * Back arrow + centered title used across FAQ/legal/settings-style screens.
 * Full-bleed divider — pass via ScreenContainer's `header` prop so it renders
 * above the padded scroll content and can reach both screen edges.
 */
export function ScreenHeader({ title, onBack, showBack = true, rightElement }: ScreenHeaderProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>
        <View style={styles.side}>{showBack ? <BackButton customAction={onBack} /> : null}</View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.side, styles.rightSide]}>{rightElement}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingX['2xl'],
    paddingVertical: spacingY.lg,
  },
  side: {
    width: SIDE_WIDTH,
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
});
