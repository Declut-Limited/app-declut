import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
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
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
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
