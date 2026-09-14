import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushAsync';
import { savePushToken } from '@/lib/pushToken';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextValue {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: Error | null;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const registeredOnce = useRef(false);

  useEffect(() => {
    // /notifications/register-token is JwtAuthGuard-protected, so there's nothing to register
    // until a session exists. Only attempt once per app session — a failure here must never block
    // navigation (see CLAUDE.md). email_phone accounts already sent their push token inline on
    // /auth/login or /auth/register (now a required payload field), so calling this again here
    // would just be redundant — only google accounts need it, since GoogleSignInPayload has no
    // pushToken field at all.
    if (status !== 'authenticated' || registeredOnce.current || user?.authProvider !== 'google') return;
    registeredOnce.current = true;

    registerForPushNotificationsAsync()
      .then(async (token) => {
        setExpoPushToken(token);
        await savePushToken(token);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [status, user?.authProvider]);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((n) => {
      if (__DEV__) console.log('Notification received:', n);
      setNotification(n);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (__DEV__) console.log('Notification response:', response);
      // No in-app deep-link routing wired yet — nothing to build ahead into (see CLAUDE.md).
      // Blocked on the backend confirming each notification type's `data` shape before this can
      // route to the right screen; see the notification-payload discussion in project memory.
    });

    // Fires with the raw native (FCM/APNs) device token, not the Expo push token the backend
    // wants — the OS can reissue that underlying token mid-session (rare, but documented), and
    // when it does, re-derive the Expo token from it rather than forwarding the native one.
    const tokenSub = Notifications.addPushTokenListener(() => {
      if (status !== 'authenticated') return;
      registerForPushNotificationsAsync()
        .then(async (token) => {
          if (__DEV__) console.log('Push token rotated, re-registered Expo token');
          setExpoPushToken(token);
          await savePushToken(token);
        })
        .catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      tokenSub.remove();
    };
  }, [status]);

  // iOS badge only ever climbs (shouldSetBadge: true on every push) since there's no per-item read
  // state in-app yet — clear it on launch and every foreground, the same "cheap enough for now"
  // approach as the app taking a fresh look at everything else on resume (see socket.ts, queryClient.ts).
  useEffect(() => {
    Notifications.setBadgeCountAsync(0).catch(() => {});

    let appState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (nextState) => {
      const cameToForeground = /inactive|background/.test(appState) && nextState === 'active';
      appState = nextState;
      if (cameToForeground) Notifications.setBadgeCountAsync(0).catch(() => {});
    });

    return () => sub.remove();
  }, []);

  return (
    <NotificationContext.Provider value={{ expoPushToken, notification, error }}>{children}</NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
