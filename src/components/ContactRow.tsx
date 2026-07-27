import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useSingleTap } from '@/hooks/useSingleTap';

interface ContactRowAction {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

interface ContactRowProps {
  label: string;
  value: string;
  subtitle?: string;
  btnIcon?: React.ReactNode;
  action?: ContactRowAction;
  responseTime?: string;
  /** Makes the whole row tappable (used by the Chat row, which has no action pill). */
  onPress?: () => void;
}

export function ContactRow({ label, value, subtitle, btnIcon, action, responseTime, onPress }: ContactRowProps) {
  const guard = useSingleTap();

  const content = (
    <View style={styles.row}>
      {btnIcon ? <View style={styles.btnIcon}>{btnIcon}</View> : null}
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {responseTime ? <Text style={styles.responseTime}>{responseTime}</Text> : null}
      </View>
      {action ? (
        <Pressable style={styles.actionButton} onPress={guard(action.onPress)} accessibilityRole="button">
          {action.icon}
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
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
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  btnIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: '#25D36622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.gray900,
  },
  value: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray600,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  responseTime: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  actionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
});
