import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacingX } from '@/constants/theme';
import { scale, verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { SocialButtonProps } from '@/utils/types';

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
    minHeight: verticalScale(56),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingX.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingX.sm,
  },
  icon: {
    width: scale(20),
    height: scale(20),
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.gray900,
  },
});
