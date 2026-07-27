import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { IdentificationCard } from 'phosphor-react-native';
import { BottomSheetCard, Button, Input, StepHeader } from '@/components';
import { colors, fontFamily, fontSize, spacing } from '@/theme/tokens';
import { useKycFlow } from '@/context/KycFlowContext';
import { verifyNin } from '@/api/kyc';
import { extractErrorMessage } from '@/api/client';
import { showErrorToast } from '@/lib/toast';

const NIN_LENGTH = 11;

export function VerifyNinSheet() {
  const { goToSelfieStep } = useKycFlow();
  const [nin, setNin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (nin.length !== NIN_LENGTH) {
      setError(`Enter your ${NIN_LENGTH}-digit National Identification Number.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await verifyNin({ nin });
      goToSelfieStep();
    } catch (e) {
      const message = extractErrorMessage(e, 'Could not verify your NIN. Please try again.');
      setError(message);
      showErrorToast('NIN verification failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheetCard>
      <StepHeader step={2} total={3} />
      <Text style={styles.headline}>Let's verify its you</Text>
      <Text style={styles.subtext}>
        Declut is required by Nigerian law to verify user identity. Your NIN is never stored — only used for a
        one-time match with NIBSS records.
      </Text>

      <Input
        placeholder="National Identification Number (NIN)"
        btnIcon={<IdentificationCard size={20} color={colors.gray400} />}
        value={nin}
        onChangeText={(text) => setNin(text.replace(/[^0-9]/g, '').slice(0, NIN_LENGTH))}
        keyboardType="number-pad"
        maxLength={NIN_LENGTH}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Verify Identity" onPress={handleContinue} loading={submitting} />
    </BottomSheetCard>
  );
}

const styles = StyleSheet.create({
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
