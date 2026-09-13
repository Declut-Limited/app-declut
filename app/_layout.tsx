import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashScreen, Stack } from 'expo-router';
import { IconContext } from 'phosphor-react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DMSerifText_400Regular } from '@expo-google-fonts/dm-serif-text';
import { AuthProvider } from '@/contexts/AuthContext';
import { RealtimeProvider } from '@/contexts/RealtimeContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SearchFilterProvider } from '@/contexts/SearchFilterContext';
import { colors } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import ErrorFallback from './error';

import * as Notifications from 'expo-notifications';

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
    DMSerifText_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={(error, info) => console.error('Global error caught:', error, info)}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
            <IconContext.Provider value={{ size: verticalScale(22), color: colors.gray700, weight: 'regular' }}>
              <AuthProvider>
                <RealtimeProvider>
                <NotificationProvider>
                  <NetworkProvider>
                    <SearchFilterProvider>
                      {/* Bottom navigation */}
                      {/* <View style={{ flex: 1, paddingBottom: verticalScale(sysNavigationHeight - 4), }}> */}
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="index" />
                          <Stack.Screen name="(modals)/addItemModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/payoutDetailsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/listingDetailsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/myListingDetailsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/transactionDetailsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/myListings" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/accountDetails" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/paymentInfo" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/nearbyListingsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/newListingsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/filterByModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/searchResultsModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/helpAndSupport" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/privacyPolicy" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/termsOfUse" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/notificationSettingModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="(modals)/submitReportModal" options={{ presentation: 'modal' }} />
                        </Stack>
                      {/* </View> */}
                    </SearchFilterProvider>
                  </NetworkProvider>
                </NotificationProvider>
                </RealtimeProvider>
              </AuthProvider>
            </IconContext.Provider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      )}
    </ErrorBoundary>
  );
}
