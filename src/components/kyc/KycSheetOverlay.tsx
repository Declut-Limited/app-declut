import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useKycFlow } from '@/context/KycFlowContext';
import { VerifyEmailSheet } from './VerifyEmailSheet';
import { VerifyNinSheet } from './VerifyNinSheet';
import { SelfieCheckSheet } from './SelfieCheckSheet';

// MOUNTED IN (auth)/_layout.tsx AS A SIBLING TO THE STACK, OVERLAID ON TOP
export function KycSheetOverlay() {
  const { status, user } = useAuth();
  const { step } = useKycFlow();

  if (status !== 'authenticated' || !user) return null;

  if (!user.emailVerified) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <VerifyEmailSheet />
      </View>
    );
  }

  if (user.kycStatus !== 'verified') {
    return (
      <View style={StyleSheet.absoluteFill}>
        {step === 'nin' ? <VerifyNinSheet /> : <SelfieCheckSheet />}
      </View>
    );
  }

  return null;
}
