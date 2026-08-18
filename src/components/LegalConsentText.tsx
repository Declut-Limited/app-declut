import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors, fontFamily, fontSize } from '@/constants/theme';
import type { LegalConsentTextProps } from '@/utils/types';

export function LegalConsentText({
  onPressTerms = () => router.push('/(legal)/terms-of-use'),
  onPressPrivacy = () => router.push('/(legal)/privacy-policy'),
}: LegalConsentTextProps) {
  return (
    <Text style={styles.text}>
      By clicking "Continue", I have read and agree with the{' '}
      <Text style={styles.link} onPress={onPressTerms} accessibilityRole="link">
        Terms and Condition
      </Text>
      ,{' '}
      <Text style={styles.link} onPress={onPressPrivacy} accessibilityRole="link">
        Privacy Policy
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.gray400,
    textAlign: 'center',
  },
  link: {
    textDecorationLine: 'underline',
    color: colors.gray500,
  },
});
