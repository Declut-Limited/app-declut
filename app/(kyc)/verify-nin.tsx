import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { IdentificationCard } from 'phosphor-react-native';
import { Button, Card, Input, ScreenContainer, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, radii, spacing } from '@/theme/tokens';
import { useKycFlow } from '@/context/KycFlowContext';

const NIN_LENGTH = 11;

export default function VerifyNinScreen() {
  const { nin, setNin } = useKycFlow();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (nin.length !== NIN_LENGTH) {
      setError(`Enter your ${NIN_LENGTH}-digit National Identification Number.`);
      return;
    }
    setError(null);
    // No backend call here — NIN is held in flow state and submitted together
    // with the selfie on the next screen in a single /kyc/verify call (see CLAUDE.md).
    router.push('/(kyc)/selfie-check');
  }

  return (
    <ScreenContainer>
      <StepHeader step={2} total={3} />
      <Card style={styles.card}>
        <View style={styles.avatar}>
          <IdentificationCard size={28} color={colors.primary} />
        </View>
        <Text style={styles.headline}>Let's verify its you</Text>
        <Text style={styles.subtext}>
          Declut is required by Nigerian law to verify user identity. Your NIN is never stored — only used for a
          one-time match with NIBSS records.
        </Text>

        <Input
          placeholder="National Identification Number (NIN)"
          leadingIcon={<IdentificationCard size={20} color={colors.gray400} />}
          value={nin}
          onChangeText={(text) => setNin(text.replace(/[^0-9]/g, '').slice(0, NIN_LENGTH))}
          keyboardType="number-pad"
          maxLength={NIN_LENGTH}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Verify Identity" onPress={handleContinue} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
  error: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.danger,
    textAlign: 'center',
  },
});
