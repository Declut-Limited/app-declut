// This native module isn't part of Expo Go's bundled module set (it's a
// third-party SDK, not an Expo-owned one) — it only works in a custom dev
// client / prebuilt app. The import is deferred into each function below so
// that merely loading the sign-in/sign-up screens in plain Expo Go doesn't
// crash the app; it only throws once Google sign-in is actually attempted.
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let configured = false;

function loadModule(): GoogleSigninModule {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    throw new Error(
      'Google sign-in needs a custom dev client — it is not available in Expo Go. Build one with "npx expo run:android" or an EAS dev-client build.'
    );
  }
}

function ensureConfigured(): GoogleSigninModule {
  const mod = loadModule();
  if (configured) return mod;
  if (!webClientId) {
    // Backend verifies the ID token against GOOGLE_CLIENT_ID as audience (see CLAUDE.md) —
    // the mobile app needs the matching web client ID to request a token for that audience.
    // Not set yet, so Google sign-in can't run until this env var is provided.
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — Google sign-in is not configured yet.');
  }
  mod.GoogleSignin.configure({ webClientId });
  configured = true;
  return mod;
}

/** Runs the on-device Google sign-in flow and returns the ID token to POST to /auth/google. */
export async function getGoogleIdToken(): Promise<string> {
  const { GoogleSignin, isSuccessResponse } = ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google sign-in was cancelled or returned no ID token.');
  }
  return response.data.idToken;
}
