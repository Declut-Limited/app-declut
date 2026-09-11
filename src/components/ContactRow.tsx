import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { ContactRowProps } from '@/utils/types';

// Each contact method renders as its own standalone card (cardBackground fill) rather than a row
// stacked inside a shared container — matches the delivered design's per-method card layout.
export function ContactRow({ label, value, subtitle, btnIcon, action, responseTime, onPress }: ContactRowProps) {
  const guard = useSingleTap();

  const content = (
    <>
      <View style={styles.row}>
        {btnIcon ? <View style={styles.btnIcon}>{btnIcon}</View> : null}
        <View style={styles.textBlock}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <Pressable style={styles.actionButton} onPress={guard(action.onPress)} accessibilityRole="button">
            {action.icon}
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {responseTime ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.responseTime}>{responseTime}</Text>
        </>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={guard(onPress)} style={styles.wrapper}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacingX.lg,
    paddingVertical: spacingY.lg,
    marginBottom: spacingY.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
  },
  btnIcon: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: '#25D36622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: verticalScale(2),
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  value: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    marginTop: spacingY.md,
    marginBottom: spacingY.md,
  },
  responseTime: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.xs,
    backgroundColor: colors.primaryLight,
    paddingVertical: spacingY.sm,
    paddingHorizontal: spacingX.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
  },
  actionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
});
