import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import Icon from './Icon';
import { colors, radius } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { BackButtonProps } from '@/utils/types';

export function BackButton({ iconSize = 20, iconType = 'back', customAction, style, ...rest }: BackButtonProps) {
  const guard = useSingleTap();
  const size = verticalScale(iconSize);

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
      {iconType === 'back' ? (
        <Icon name="arrow-left" variant="linear" size={size} color={colors.gray900} />
      ) : iconType === 'cancel' ? (
        <Icons.XIcon size={size} color={colors.gray900} weight="bold" />
      ) : (
        <Icons.CaretDownIcon size={size} color={colors.gray900} weight="bold" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
