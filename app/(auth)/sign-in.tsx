import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import {
  AuthLogo,
  Button,
  Card,
  Divider,
  Input,
  LegalConsentText,
  ScreenContainer,
  SocialButton,
  TextLink,
} from '@/components';
import { colors, fontFamily, fontSize, radius, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { isVerified, useAuth } from '@/contexts/AuthContext';
import { login as loginRequest, googleSignIn } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { GoogleSignInCancelledError, useGoogleSignIn } from '@/lib/googleAuth';
import { getPushToken } from '@/lib/pushToken';
import { validateRequired } from '@/lib/validators';
import { showErrorToast, showWarningToast } from '@/lib/toast';
import Icon from '@/components/Icon';

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export default function SignInScreen() {
  const { establishSession } = useAuth();
  const { signIn: signInWithGoogle } = useGoogleSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const errors: FieldErrors = {
      identifier: validateRequired(identifier, 'Email or phone number'),
      password: validateRequired(password, 'Password'),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  async function handleContinue() {
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const pushToken = await getPushToken();
      const tokens = await loginRequest({ identifier: identifier.trim(), password, pushToken });
      const user = await establishSession(tokens);
      if (isVerified(user)) router.replace('/');
    } catch (e) {
      const message = extractErrorMessage(e, 'Invalid credentials. Please try again.');
      setError(message);
      showErrorToast('Sign in failed', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    if (__DEV__) console.log('[SignIn] Google button tapped');
    try {
      const idToken = await signInWithGoogle();
      if (__DEV__) console.log('[SignIn] got idToken, calling POST /auth/google');
      const tokens = await googleSignIn({ idToken });
      if (__DEV__) console.log('[SignIn] /auth/google succeeded, establishing session');
      const user = await establishSession(tokens);
      if (__DEV__) console.log('[SignIn] session established', { emailVerified: user.emailVerified, kycStatus: user.kycStatus });
      if (isVerified(user)) router.replace('/');
    } catch (e) {
      if (e instanceof GoogleSignInCancelledError) {
        // User backed out of the account picker — not a real failure, no error UI needed.
        if (__DEV__) console.log('[SignIn] Google sign-in cancelled by user');
      } else if (e instanceof Error && e.message.includes('not available in Expo Go')) {
        if (__DEV__) console.warn('[SignIn] Google sign-in unavailable — needs a custom dev client', e);
        showWarningToast('Not available yet', 'Google sign-in needs a custom dev client build.');
      } else {
        const message = extractErrorMessage(e, 'Google sign-in failed. Please try again.');
        if (__DEV__) {
          console.error('[SignIn] Google sign-in failed', {
            status: axios.isAxiosError(e) ? e.response?.status : undefined,
            data: axios.isAxiosError(e) ? e.response?.data : undefined,
            message,
            error: e,
          });
        }
        setError(message);
        showErrorToast('Google sign-in failed', message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.centerBlock}>
        <Card style={styles.card}>
          <AuthLogo />
          <Text style={styles.headline}>Let's get you in</Text>
          <Text style={styles.subtext}>
            To sign in to an account in the application, enter your email or phone number
          </Text>

          <View style={styles.form}>
            <Input
              placeholder="Email or Phone number"
              btnIcon={<Icon name="profile" variant="bold" size={verticalScale(20)} color={colors.gray400} />}
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={fieldErrors.identifier}
              fieldStyle={styles.fieldBackground}
            />
            <Input
              placeholder="Password"
              isPassword
              btnIcon={<Icon name="lock" variant="bold" size={verticalScale(20)} color={colors.gray400} />}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              autoCapitalize="none"
              error={fieldErrors.password}
              fieldStyle={styles.fieldBackground}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.continueButtonShadow}>
              <Button label="Continue" onPress={handleContinue} loading={loading} />
            </View>
          </View>

          <Divider />

          <View style={styles.socials}>
            <SocialButton label="Sign in with Google" onPress={handleGoogle} loading={googleLoading} disabled={googleLoading} />
          </View>
        </Card>

        <TextLink
          text="Don't have an account yet?"
          actionLabel="Create an account"
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </View>

      <View style={styles.legal}>
        <LegalConsentText />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Two top-level children now (centerBlock, legal) — space-between pins the legal disclaimer to
  // the very bottom of the screen instead of it just trailing the card with a fixed margin.
  container: {
    justifyContent: 'space-between',
  },
  // Card + "Create an account" link stay centered as a group within whatever space is left above
  // the legal footer, rather than the whole screen being one centered block.
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: spacingY.xl,
  },
  // Narrower than Card's own default paddingHorizontal — the design's content sits closer to the
  // card's edges than the shared component's default allows for.
  card: {
    gap: spacingY.lg,
    paddingHorizontal: spacingX.lg,
  },
  // Recessed to match the page background rather than the generic gray100 fill, so the field reads
  // as part of the same surface as the app background instead of an arbitrary gray box.
  fieldBackground: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.gray500,
    textAlign: 'center',
  },
  form: {
    gap: spacingY.md,
  },
  // Soft tinted glow under the primary CTA — a local wrapper rather than a Button.tsx change,
  // since Button spreads a caller-supplied `style` last and would silently lose its own fill logic.
  continueButtonShadow: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  socials: {
    gap: spacingY.md,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  legal: {
    paddingHorizontal: spacingX.md,
    paddingBottom: spacingY.md,
  },
});
