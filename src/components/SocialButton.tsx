import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import { AppleLogo, GoogleLogo } from 'phosphor-react-native';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useSingleTap } from '@/hooks/useSingleTap';

export type SocialProvider = 'google' | 'apple';

interface SocialButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  provider: SocialProvider;
  label: string;
  loading?: boolean;
  onPress?: () => void | Promise<void>;
}

export function SocialButton({ provider, label, disabled, loading, onPress, ...rest }: SocialButtonProps) {
  const isApple = provider === 'apple';
  const isDisabled = disabled || loading;
  const guard = useSingleTap();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={onPress ? guard(onPress) : undefined}
      style={({ pressed }) => [
        styles.base,
        isApple ? styles.apple : styles.google,
        { opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={isApple ? colors.white : colors.gray700} />
        ) : (
          <>
            {isApple ? (
              <AppleLogo size={20} weight="fill" color={colors.white} />
            ) : (
              // Phosphor's GoogleLogo is monochrome — a full-colour "G" mark isn't
              // available without pulling in @gems-group/icons for this one glyph.
              <GoogleLogo size={20} weight="bold" color={colors.gray700} />
            )}
            <Text style={[styles.label, isApple ? styles.appleLabel : styles.googleLabel]}>{label}</Text>
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
  },
  google: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  apple: {
    backgroundColor: colors.black,
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
  googleLabel: { color: colors.gray900 },
  appleLabel: { color: colors.white },
});
