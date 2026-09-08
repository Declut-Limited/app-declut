// This native module isn't part of Expo Go's bundled module set (it's a
// third-party SDK, not an Expo-owned one) — it only works in a custom dev
// client / prebuilt app. The import is deferred into each function below so
// that merely loading the sign-in/sign-up screens in plain Expo Go doesn't
// crash the app; it only throws once Google sign-in is actually attempted.
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let configured = false;

function unavailableError(): Error {
  return new Error(
    'Google sign-in needs a custom dev client — it is not available in Expo Go. Build one with "npx expo run:android" or an EAS dev-client build.'
  );
}

// The native module can fail to resolve either when its JS file is first required, or lazily on
// the first actual method call (configure/hasPlayServices/signIn) — depends on the installed
// version/platform. TurboModuleRegistry throws the same way either time, so both paths get
// converted to the same friendly, already-handled error instead of an uncaught native crash.
function isNativeModuleMissing(error: unknown): boolean {
  return error instanceof Error && error.message.includes('TurboModuleRegistry');
}

function loadModule(): GoogleSigninModule {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch {
    throw unavailableError();
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
  try {
    mod.GoogleSignin.configure({ webClientId });
  } catch (e) {
    throw isNativeModuleMissing(e) ? unavailableError() : e;
  }
  configured = true;
  return mod;
}

/** Thrown when the user dismisses the Google account picker — not a real failure, callers should treat it as a silent no-op. */
export class GoogleSignInCancelledError extends Error {}

/** Runs the on-device Google sign-in flow and returns the ID token to POST to /auth/google. */
export async function getGoogleIdToken(): Promise<string> {
  const { GoogleSignin, isSuccessResponse, isCancelledResponse } = ensureConfigured();
  let response;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (e) {
    throw isNativeModuleMissing(e) ? unavailableError() : e;
  }
  if (isCancelledResponse(response)) {
    throw new GoogleSignInCancelledError('Google sign-in was cancelled.');
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google sign-in returned no ID token.');
  }
  return response.data.idToken;
}
