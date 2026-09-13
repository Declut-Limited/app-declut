import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

// RN has no browser 'online'/'visibilitychange' events — React Query needs these wired manually.
// Reuses the same NetInfo instance NetworkContext's offline banner already listens to, so query
// retry/pause-when-offline behavior and the banner always agree about connectivity.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => setOnline(!!state.isConnected));
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
}

AppState.addEventListener('change', onAppStateChange);

// A 4xx here (bad input, 401, 403, 404, 409) is permanent for the request that produced it —
// retrying just delays the error reaching the user. Only network failures/timeouts and 5xx are
// worth a couple of automatic retries.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
    },
    mutations: {
      // Most mutations in this app move money or change escrow/listing state (checkout, confirm,
      // pause/delete, reviews, reports). Silently auto-retrying a POST/PATCH after a timeout risks
      // a double side effect that the UI's tap-guard (see CLAUDE.md) doesn't protect against, since
      // the first attempt may already have succeeded server-side. Opt in per mutation instead.
      retry: false,
    },
  },
});
