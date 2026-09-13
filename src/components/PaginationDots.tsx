import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { colors, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import type { PaginationDotsProps } from '@/utils/types';

const DOT_SIZE = verticalScale(8);
const ACTIVE_WIDTH = verticalScale(24);

export function PaginationDots({ count, scrollX, screenWidth }: PaginationDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} index={index} scrollX={scrollX} screenWidth={screenWidth} />
      ))}
    </View>
  );
}

function Dot({ index, scrollX, screenWidth }: { index: number; scrollX: PaginationDotsProps['scrollX']; screenWidth: number }) {
  const style = useAnimatedStyle(() => {
    const distance = scrollX.value / screenWidth - index;
    return {
      width: interpolate(distance, [-1, 0, 1], [DOT_SIZE, ACTIVE_WIDTH, DOT_SIZE], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(distance, [-1, 0, 1], [colors.gray300, colors.primary, colors.gray300]),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    marginBottom: spacingY.sm,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderCurve: 'continuous',
  },
});
