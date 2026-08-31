import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { isVerified, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

export default function Index() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (status === 'onboarding') return <Redirect href="/(onboarding)" />;
  if (status === 'authenticated' && isVerified(user)) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/(auth)/sign-in" />;
}
