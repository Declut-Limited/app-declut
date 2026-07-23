import React from 'react';
import { ActivityIndicator, Image, Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useSingleTap } from '@/hooks/useSingleTap';

interface SocialButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  label: string;
  loading?: boolean;
  onPress?: () => void | Promise<void>;
}

/** Google sign-in/sign-up button. Apple was removed — no backend endpoint for it (see CLAUDE.md). */
export function SocialButton({ label, disabled, loading, onPress, ...rest }: SocialButtonProps) {
  const isDisabled = disabled || loading;
  const guard = useSingleTap();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={onPress ? guard(onPress) : undefined}
      style={({ pressed }) => [styles.base, { opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 }]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.gray700} />
        ) : (
          <>
            <Image source={require('../../assets/google.png')} style={styles.icon} resizeMode="contain" />
            <Text style={styles.label}>{label}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 20,
    height: 20,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
});
