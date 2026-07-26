import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer, Button } from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';

// STUB LANDING ROUTE — HOME SCREEN NOT YET DESIGNED
export default function HomeScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>You're in, {user?.name ?? 'there'}.</Text>
      <Text style={styles.subtitle}>
        Onboarding, sign-in/up, and the mandatory OTP → NIN → liveness chain are done. The home screen itself
        hasn't been designed yet.
      </Text>
      <Button label="Sign out" variant="outline" onPress={handleSignOut} />
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
