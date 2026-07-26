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
import { isVerified, useAuth } from '@/context/AuthContext';
import { register, googleSignIn } from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { getGoogleIdToken } from '@/lib/googleAuth';
import { validateEmail, validateName, validateNigerianLocalPhone, validatePassword } from '@/lib/validators';
import { showErrorToast, showWarningToast } from '@/lib/toast';
import Icon from '@/components/Icon';

const PHONE_COUNTRY_CODE = '+234';

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export default function SignUpScreen() {
  const { establishSession, establishRegisteredSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(PHONE_COUNTRY_CODE);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const errors: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      phone: validateNigerianLocalPhone(phone.replace(PHONE_COUNTRY_CODE, '')),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  async function handleContinue() {
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { otpToken, ...tokens } = await register({ name: name.trim(), email: email.trim(), phone, password });
      await establishRegisteredSession(tokens, otpToken);
    } catch (e) {
      const message = extractErrorMessage(e, 'Could not create your account. Please try again.');
      setError(message);
      showErrorToast('Sign up failed', message);
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
    <ScreenContainer>
      <Card style={styles.card}>
        <AuthLogo />
        <Text style={styles.headline}>Let's get started</Text>
        <Text style={styles.subtext}>To create an account in the application, enter your details below</Text>

        <View style={styles.form}>
          <Input
            placeholder="Full name"
            leadingIcon={<Icon name="profile" variant="bold" size={20} color={colors.gray400} />}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            autoCapitalize="words"
            error={fieldErrors.name}
          />
          <Input
            placeholder="Email"
            leadingIcon={<Icon name="sms" variant="bold" size={20} color={colors.gray400} />}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldErrors.email}
          />
          <PhoneInput
            value={phone}
            onChangeValue={(value) => {
              setPhone(value);
              setFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            error={fieldErrors.phone}
          />
          <Input
            placeholder="Password"
            isPassword
            leadingIcon={<Icon name="lock" variant="bold" size={20} color={colors.gray400} />}
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
          <SocialButton label="Sign up with Google" onPress={handleGoogle} loading={googleLoading} disabled={googleLoading} />
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
