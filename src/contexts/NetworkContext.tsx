import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { StatusBar } from 'expo-status-bar';

interface NetworkContextValue {
  isConnected: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({ isConnected: true });

const RECONNECTED_BANNER_DURATION_MS = 2000;

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const wasDisconnected = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      setIsConnected(connected);

      if (!connected) {
        wasDisconnected.current = true;
        setShowReconnected(false);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }),
        ]).start();
        return;
      }

      if (!wasDisconnected.current) return;

      // No full app reload here — react-query's onlineManager (queryClient.ts) already resumes/
      // refetches paused queries on reconnect. A hard reload also has a nasty side effect: it forces
      // the auth boot sequence (hydrateSession -> getMyProfile) to run its network calls at the exact
      // moment the connection just came back and is least reliable, which used to make ordinary
      // signal drops look like session expiry.
      setShowReconnected(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true }),
        ]).start(() => {
          wasDisconnected.current = false;
          // Without this, the banner (and the StatusBar override below) would be considered
          // "active" forever after the very first reconnect — invisible from the animation, but
          // never actually unmounted, since showBanner below never turns false again.
          setShowReconnected(false);
        });
      }, RECONNECTED_BANNER_DURATION_MS);
    });

    return unsubscribe;
  }, [fadeAnim, slideAnim]);

  // One flag for both the banner and its StatusBar override, so neither renders — and neither
  // claims the status bar's space — outside the window where a banner is actually relevant.
  const showBanner = !isConnected || showReconnected;

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
      {showBanner ? (
        <>
          {/* Android only tints via backgroundColor; on iOS the status bar is inherently transparent — the banner's own paddingTop (below) is what shows through there. */}
          <StatusBar style="light" backgroundColor={showReconnected ? colors.success : colors.danger} animated />

          <Animated.View
            style={[
              styles.banner,
              {
                paddingTop: insets.top + spacingY.sm,
                backgroundColor: showReconnected ? colors.success : colors.danger,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{showReconnected ? '✓' : '⚠'}</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.title}>{showReconnected ? 'Back Online' : 'No Internet Connection'}</Text>
                <Text style={styles.subtitle}>
                  {showReconnected ? 'Your connection has been restored' : 'Please check your network settings'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </>
      ) : null}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: spacingY.lg,
    paddingHorizontal: spacingX.xl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX.md,
  },
  iconContainer: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: fontSize.lg,
    color: colors.white,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.white,
    marginBottom: verticalScale(2),
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export function useNetwork() {
  return useContext(NetworkContext);
}
