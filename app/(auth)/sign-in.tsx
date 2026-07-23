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
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { login as loginRequest, googleSignIn } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { getGoogleIdToken } from '@/lib/googleAuth';
import { validateRequired } from '@/lib/validators';

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
      await establishSession(tokens);
      router.replace('/');
    } catch (e) {
      setError(extractErrorMessage(e, 'Invalid credentials. Please try again.'));
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
      await establishSession(tokens);
      router.replace('/');
    } catch (e) {
      setError(extractErrorMessage(e, 'Google sign-in failed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <AuthLogo />
        <Text style={styles.headline}>Let's get you in</Text>
        <Text style={styles.subtext}>
          To sign in to an account in the application, enter your email or phone number
        </Text>

        <View style={styles.form}>
          <Input
            placeholder="Email or Phone number"
            leadingIcon={<User size={20} color={colors.gray400} />}
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.identifier}
          />
          {/* Position/style estimated — no fresh screenshot confirms exact placement (see CLAUDE.md). */}
          <Input
            placeholder="Password"
            isPassword
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
  card: {
    gap: spacing.lg,
    marginTop: spacing['3xl'],
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  socials: {
    gap: spacing.md,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  legal: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
