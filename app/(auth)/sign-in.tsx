import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { User } from 'phosphor-react-native';
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
import { colors, fontFamily, fontSize, spacingX, spacingY } from '@/constants/theme';
import { verticalScale } from '@/utils/styling';
import { isVerified, useAuth } from '@/contexts/AuthContext';
import { login as loginRequest, googleSignIn } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { getGoogleIdToken } from '@/lib/googleAuth';
import { validateRequired } from '@/lib/validators';
import { showErrorToast, showWarningToast } from '@/lib/toast';
import Icon from '@/components/Icon';

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export default function SignInScreen() {
  const { establishSession } = useAuth();
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
      const tokens = await loginRequest({ identifier: identifier.trim(), password });
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
    try {
      const idToken = await getGoogleIdToken();
      const tokens = await googleSignIn({ idToken });
      const user = await establishSession(tokens);
      if (isVerified(user)) router.replace('/');
    } catch (e) {
      if (e instanceof Error && e.message.includes('not available in Expo Go')) {
        showWarningToast('Not available yet', 'Google sign-in needs a custom dev client build.');
      } else {
        const message = extractErrorMessage(e, 'Google sign-in failed. Please try again.');
        setError(message);
        showErrorToast('Google sign-in failed', message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <ScreenContainer style={styles.container}>
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
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Continue" onPress={handleContinue} loading={loading} />
        </View>

        <Divider />

        <View style={styles.socials}>
          <SocialButton label="Sign in with Google" onPress={handleGoogle} loading={googleLoading} disabled={googleLoading} />
        </View>

        <TextLink
          text="Don't have an account yet?"
          actionLabel="Create an account"
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </Card>

      <View style={styles.legal}>
        <LegalConsentText />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  card: {
    gap: spacingY.lg,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  form: {
    gap: spacingY.md,
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
    marginTop: spacingY.xl,
    paddingHorizontal: spacingX.md,
  },
});
