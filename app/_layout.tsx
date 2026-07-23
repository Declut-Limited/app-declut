import 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={(error, info) => console.error('Global error caught:', error, info)}>
      {!fontsLoaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
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
        </GestureHandlerRootView>
      )}
    </ErrorBoundary>
  );
}
