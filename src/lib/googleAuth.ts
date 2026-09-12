import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Required once at module scope so the browser tab opened for the OAuth redirect closes itself
// and hands control back to the app instead of sitting there after Google redirects back in.
WebBrowser.maybeCompleteAuthSession();

// Firebase Auth is not part of Expo Go's bundled module set (it's a third-party native SDK) — it
// only works in a custom dev client / prebuilt app. The import is deferred into the function below
// so that merely loading the sign-in/sign-up screens in plain Expo Go doesn't crash the app; it
// only throws once Google sign-in is actually attempted. expo-auth-session/expo-web-browser above
// are plain Expo SDK packages and work fine in Expo Go, so they stay as static imports.
type FirebaseAuthModule = typeof import('@react-native-firebase/auth');

const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

function unavailableError(): Error {
  return new Error(
    'Google sign-in needs a custom dev client — it is not available in Expo Go. Build one with "npx expo run:android" or an EAS dev-client build.'
  );
}

// TurboModuleRegistry throws the same way whether Firebase's native module fails to resolve on
// first require() or lazily on the first actual auth call — both paths get converted to the same
// friendly, already-handled error instead of an uncaught native crash.
function isNativeModuleMissing(error: unknown): boolean {
  return error instanceof Error && error.message.includes('TurboModuleRegistry');
}

function loadFirebaseAuth(): FirebaseAuthModule {
  try {
    return require('@react-native-firebase/auth');
  } catch (e) {
    if (__DEV__) console.error('[GoogleAuth] require(@react-native-firebase/auth) failed', e);
    throw unavailableError();
  }
}

/** Thrown when the user dismisses the Google account picker — not a real failure, callers should treat it as a silent no-op. */
export class GoogleSignInCancelledError extends Error {}

async function exchangeForFirebaseIdToken(googleIdToken: string): Promise<string> {
  try {
    if (__DEV__) console.log('[GoogleAuth] exchanging Google credential for a Firebase session');
    const { getAuth, GoogleAuthProvider, signInWithCredential } = loadFirebaseAuth();
    const credential = GoogleAuthProvider.credential(googleIdToken);
    const userCredential = await signInWithCredential(getAuth(), credential);
    const firebaseIdToken = await userCredential.user.getIdToken();
    if (__DEV__) console.log('[GoogleAuth] exchange succeeded, firebase idToken length', firebaseIdToken.length);
    return firebaseIdToken;
  } catch (e) {
    if (__DEV__) console.error('[GoogleAuth] Firebase signInWithCredential/getIdToken threw', e);
    throw isNativeModuleMissing(e) ? unavailableError() : e;
  }
}

/**
 * Drives the on-device Google account picker via expo-auth-session, then exchanges the resulting
 * Google credential for a Firebase session and resolves with a Firebase ID token — that's what
 * /auth/google verifies (server-side, via Firebase Admin SDK), not the raw Google ID token.
 *
 * expo-auth-session's Google flow is hook-based (the redirect listener has to be registered before
 * the browser opens), so this must be called from a component body, not conjured up imperatively —
 * callers get back a plain `signIn()` promise to call from a button handler.
 */
export function useGoogleSignIn() {
  const [request, response, promptAsync] = Google.useAuthRequest({ androidClientId, iosClientId, webClientId });
  const pendingRef = useRef<{ resolve: (idToken: string) => void; reject: (e: unknown) => void } | null>(null);

  useEffect(() => {
    if (!response) return;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    if (response.type === 'success') {
      const googleIdToken = response.authentication?.idToken ?? (response.params as Record<string, string>)?.id_token;
      if (__DEV__) console.log('[GoogleAuth] promptAsync resolved', { hasIdToken: !!googleIdToken });
      if (!googleIdToken) {
        pending.reject(new Error('Google sign-in returned no ID token.'));
        return;
      }
      exchangeForFirebaseIdToken(googleIdToken).then(pending.resolve, pending.reject);
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      if (__DEV__) console.log('[GoogleAuth] user cancelled the account picker');
      pending.reject(new GoogleSignInCancelledError('Google sign-in was cancelled.'));
    } else {
      if (__DEV__) console.error('[GoogleAuth] promptAsync failed', response);
      pending.reject(new Error('Google sign-in failed.'));
    }
  }, [response]);

  async function signIn(): Promise<string> {
    if (!webClientId) {
      // Firebase Auth verifies the Google credential using this same web client as audience — it
      // must be the "Web client (auto created by Google Service)" OAuth client from the Firebase
      // project's own Google sign-in provider config, not an arbitrary Google Cloud web client.
      if (__DEV__) console.error('[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing from env');
      throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google sign-in is not configured yet.');
    }
    if (!request) throw new Error('Google sign-in is still initializing — try again in a moment.');

    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      promptAsync().catch((e) => {
        pendingRef.current = null;
        reject(e);
      });
    });
  }

  return { signIn, ready: !!request };
}
