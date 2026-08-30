import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer, Button } from '@/components';
import { colors, fontFamily, fontSize, spacingY } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

// STUB TAB — PROFILE SCREEN NOT YET DESIGNED (sign-out lives here for now)
export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  return (
    <ScreenContainer edges={['top']} background={colors.white}>
      <Text style={styles.title}>{user?.name ?? 'Profile'}</Text>
      <Text style={styles.subtitle}>This screen hasn't been designed yet.</Text>
      <Button label="Sign out" variant="outline" onPress={handleSignOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginBottom: spacingY.md,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginBottom: spacingY['2xl'],
  },
});
