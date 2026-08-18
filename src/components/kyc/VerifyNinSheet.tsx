import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { IdentificationCard } from 'phosphor-react-native';
import { BottomSheetCard, Button, Input, StepHeader } from '@/components';
import { colors, fontFamily, fontSize } from '@/constants/theme';
import { useKycFlow } from '@/contexts/KycFlowContext';

const NIN_LENGTH = 11;

export function VerifyNinSheet() {
  const { goToSelfieStep } = useKycFlow();
  const [nin, setNin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // TEMPORARY — /kyc/verify-nin isn't live on the backend yet. Validate the
  // format locally and move on; swap back to the real API call once it ships
  // (see CLAUDE.md).
  function handleContinue() {
    if (nin.length !== NIN_LENGTH) {
      setError(`Enter your ${NIN_LENGTH}-digit National Identification Number.`);
      return;
    }
    setError(null);
    goToSelfieStep();
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

      <Button label="Verify Identity" onPress={handleContinue} />
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
    fontFamily: fontFamily.medium,
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
