import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize } from '@/constants/theme';
import { useSingleTap } from '@/hooks/useSingleTap';
import type { TextLinkProps } from '@/utils/types';

/**
 * Centered nav link. Pass `text` for the "Don't have an account yet? Create an
 * account" pattern, or omit/empty it for a standalone link like onboarding's "Sign up".
 */
export function TextLink({ text, actionLabel, onPress }: TextLinkProps) {
  const guard = useSingleTap();

  return (
    <Text style={styles.text}>
      {text ? `${text} ` : null}
      <Text style={styles.action} onPress={guard(onPress)} accessibilityRole="link">
        {actionLabel}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  action: {
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
});
