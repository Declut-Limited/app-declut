import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/tokens';

/** Root gate — routes to onboarding / auth / mandatory KYC chain / app based on session state. */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'onboarding') return <Redirect href="/(onboarding)" />;
  if (status === 'unauthenticated') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'needs-email-verification') return <Redirect href="/(kyc)/verify-email" />;
  if (status === 'needs-kyc') return <Redirect href="/(kyc)/verify-nin" />;
  return <Redirect href="/(app)/home" />;
}
