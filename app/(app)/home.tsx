import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer, Button } from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';

/**
 * Stub landing route — not a designed screen. Nothing past auth/KYC has been
 * shared in docs/DESIGN.md yet, but the flow needs somewhere to land once
 * verification is complete (see CLAUDE.md, "don't build ahead into screens
 * not yet provided" — this is a placeholder, not a built-ahead screen).
 */
export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>You're in, {user?.name ?? 'there'}.</Text>
      <Text style={styles.subtitle}>
        Onboarding, sign-in/up, and the mandatory OTP → NIN → liveness chain are done. The home screen itself
        hasn't been designed yet.
      </Text>
      <Button label="Sign out" variant="outline" onPress={signOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginBottom: spacing['2xl'],
  },
});
