import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Envelope, User } from 'phosphor-react-native';
import {
  AuthLogo,
  Button,
  Card,
  Divider,
  Input,
  LegalConsentText,
  PhoneInput,
  ScreenContainer,
  SocialButton,
  TextLink,
} from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';
import { useAuth } from '@/context/AuthContext';
import { register, googleSignIn } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { getGoogleIdToken } from '@/lib/googleAuth';

export default function SignUpScreen() {
  const { establishSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+234');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      const { otpToken, ...tokens } = await register({ name: name.trim(), email: email.trim(), phone, password });
      await establishSession(tokens, otpToken);
      router.replace('/');
    } catch (e) {
      setError(extractErrorMessage(e, 'Could not create your account. Please try again.'));
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
        <Text style={styles.headline}>Let's get started</Text>
        <Text style={styles.subtext}>To create an account in the application, enter your details below</Text>

        <View style={styles.form}>
          {/* Name, phone (as a full field, not just the country segment) and
              password are additions beyond the original 2-field mockup — see
              CLAUDE.md ("Auth Flow — resolved 2026-07-23"). */}
          <Input
            placeholder="Full name"
            leadingIcon={<User size={20} color={colors.gray400} />}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Input
            placeholder="Email"
            leadingIcon={<Envelope size={20} color={colors.gray400} />}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <PhoneInput value={phone} onChangeValue={setPhone} />
          <Input
            placeholder="Password"
            isPassword
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Continue" onPress={handleContinue} loading={loading} />
        </View>

        <Divider />

        <View style={styles.socials}>
          <SocialButton provider="google" label="Sign up with Google" onPress={handleGoogle} loading={googleLoading} disabled={googleLoading} />
          {/* Apple button matches the design visually but isn't wired — no backend endpoint yet (see CLAUDE.md). */}
          <SocialButton provider="apple" label="Sign up with Apple" onPress={() => {}} disabled />
        </View>

        <TextLink text="Have an account?" actionLabel="Sign in" onPress={() => router.push('/(auth)/sign-in')} />
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
