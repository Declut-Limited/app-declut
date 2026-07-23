import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '@/theme/tokens';

interface PaginationDotsProps {
  count: number;
  activeIndex: number;
}

const DOT_SIZE = 8;
const ACTIVE_WIDTH = 24;

export function PaginationDots({ count, activeIndex }: PaginationDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} active={index === activeIndex} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? ACTIVE_WIDTH : DOT_SIZE, { duration: 220 }),
    backgroundColor: withTiming(active ? colors.primary : colors.gray300, { duration: 220 }),
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
