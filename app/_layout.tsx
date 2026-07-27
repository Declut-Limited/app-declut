import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
// import 'react-native-gesture-handler';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashScreen, Stack } from 'expo-router';
import { IconContext } from 'phosphor-react-native';
import { ErrorBoundary } from 'react-error-boundary';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '@/context/AuthContext';
import { NetworkProvider } from '@/context/NetworkContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { colors } from '@/theme/tokens';
import ErrorFallback from './error';

import * as Notifications from 'expo-notifications';

import * as SecureStore from 'expo-secure-store';
['declut.accessToken', 'declut.refreshToken', 'declut.onboardingSeen', 'declut.emailOtpToken'].forEach((key) =>
  SecureStore.deleteItemAsync(key).catch(() => {})
);

Notifications.setNotificationHandler({
	handleNotification: async () => {
		return {
			shouldPlaySound: true,
			shouldSetBadge: true,
			shouldShowAlert: true,
		};
	},
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={(error, info) => console.error('Global error caught:', error, info)}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
          <SafeAreaProvider style={{ flex: 1 }}>
            <IconContext.Provider value={{ size: 22, color: colors.gray700, weight: 'regular' }}>
              <AuthProvider>
                <NotificationProvider>
                  <NetworkProvider>
                    <Stack screenOptions={{ headerShown: false }} />
                  </NetworkProvider>
                </NotificationProvider>
              </AuthProvider>
            </IconContext.Provider>
          </SafeAreaProvider>
      )}
    </ErrorBoundary>
  );
}
