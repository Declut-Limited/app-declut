import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import { useRealtime } from '@/contexts/RealtimeContext';

interface NewListingsBannerProps {
  onRefresh: () => void;
}

/** Shown when a realtime `listings:new` event has landed since the last dismiss — a tap-to-
 *  refresh banner, deliberately not an auto-splice into whatever list is already on screen (see
 *  RealtimeContext / CLAUDE.md's realtime section). Used on Home and its two "See All" modals. */
export function NewListingsBanner({ onRefresh }: NewListingsBannerProps) {
  const guard = useSingleTap();
  const { hasNewListings, dismissNewListings } = useRealtime();

  if (!hasNewListings) return null;

  function handlePress() {
    onRefresh();
    dismissNewListings();
  }

  return (
    <Pressable onPress={guard(handlePress)} style={styles.banner}>
      <Icons.ArrowClockwiseIcon size={verticalScale(16)} color={colors.white} weight="bold" />
      <Text style={styles.text}>New listings available — Tap to refresh</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    paddingVertical: spacingY.sm,
    marginBottom: spacingY.lg,
  },
  text: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
});
