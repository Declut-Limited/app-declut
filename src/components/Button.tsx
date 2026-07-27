import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';

export type ButtonVariant = 'dark' | 'primary' | 'outline' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  btnIcon?: React.ReactNode;
  onPress?: () => void | Promise<void>;
  tapGuardDelay?: number;
}

const fillByVariant: Record<ButtonVariant, { background: string; text: string; border?: string }> = {
  dark: { background: colors.ink, text: colors.white },
  primary: { background: colors.primary, text: colors.white },
  outline: { background: colors.white, text: colors.gray900, border: colors.gray200 },
  ghost: { background: 'transparent', text: colors.ink, border: 'transparent' },
};

export function Button({
  label,
  variant = 'primary',
  loading,
  btnIcon,
  disabled,
  onPress,
  tapGuardDelay = 800,
  ...rest
}: ButtonProps) {
  const fill = fillByVariant[variant];
  const isDisabled = disabled || loading;
  const inFlight = useRef(false);

  const handlePress = useCallback(() => {
    if (!onPress || inFlight.current || isDisabled) return;
    inFlight.current = true;
    const result = onPress();
    if (result instanceof Promise) {
      result.finally(() => {
        inFlight.current = false;
      });
    } else {
      setTimeout(() => {
        inFlight.current = false;
      }, tapGuardDelay);
    }
  }, [onPress, isDisabled, tapGuardDelay]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: fill.background,
          borderColor: fill.border ?? fill.background,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        variant === 'ghost' && { paddingVertical: 0, minHeight: 10, },
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fill.text} />
        ) : (
          <>
            {btnIcon}
            <Text style={[styles.label, { color: fill.text }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
});