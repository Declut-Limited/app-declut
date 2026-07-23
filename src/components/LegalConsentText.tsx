import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize } from '@/theme/tokens';

interface LegalConsentTextProps {
  onPressTerms?: () => void;
  onPressPrivacy?: () => void;
}

// Terms/Privacy URLs aren't confirmed yet — onPress handlers default to no-ops
// until there's a real destination (in-app screen or external link) to send to.
export function LegalConsentText({ onPressTerms, onPressPrivacy }: LegalConsentTextProps) {
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
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.gray400,
    textAlign: 'center',
  },
  link: {
    textDecorationLine: 'underline',
    color: colors.gray500,
  },
});
