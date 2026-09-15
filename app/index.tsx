import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { isVerified, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';
import LottieView from "lottie-react-native";
import { verticalScale } from '@/utils/styling';

export default function Index() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        {/* <ActivityIndicator color={colors.primary} size="large" /> */}
        <LottieView source={require("./../assets/over-d-earth.json")} loop autoPlay style={{ width: verticalScale(250), height: verticalScale(250) }} />
      </View>
    );
  }
  
  if (status === 'onboarding') return <Redirect href="/(onboarding)" />;
  if (status === 'authenticated' && isVerified(user)) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/(auth)/sign-in" />;
}
