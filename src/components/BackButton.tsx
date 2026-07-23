import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { CaretDown, CaretLeft, X } from 'phosphor-react-native';
import { colors, radii } from '@/theme/tokens';
import { useSingleTap } from '@/hooks/useSingleTap';

type BackButtonIconType = 'back' | 'cancel' | 'drop';

interface BackButtonProps extends Omit<PressableProps, 'style' | 'onPress'> {
  iconSize?: number;
  iconType?: BackButtonIconType;
  /** Overrides the default router.back() — e.g. to dismiss a modal step instead of navigating away. */
  customAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const iconByType = { back: CaretLeft, cancel: X, drop: CaretDown };

export function BackButton({ iconSize = 20, iconType = 'back', customAction, style, ...rest }: BackButtonProps) {
  const guard = useSingleTap();
  const Icon = iconByType[iconType];

  function handlePress() {
    if (customAction) customAction();
    else router.back();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={iconType === 'cancel' ? 'Close' : 'Go back'}
      style={[styles.button, style]}
      onPress={guard(handlePress)}
      {...rest}
    >
      <Icon size={iconSize} color={colors.gray900} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
