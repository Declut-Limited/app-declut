import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type KycStep = 'nin' | 'selfie';

interface KycFlowContextValue {
  step: KycStep;
  goToSelfieStep: () => void;
  goToNinStep: () => void;
}

const KycFlowContext = createContext<KycFlowContextValue | undefined>(undefined);

// TRACKS WHICH KYC SHEET (NIN OR SELFIE) KycSheetOverlay SHOWS NEXT
export function KycFlowProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [step, setStep] = useState<KycStep>('nin');

  useEffect(() => {
    if (status === 'authenticated' || status === 'unauthenticated') {
      setStep('nin');
    }
  }, [status]);

  const value = useMemo(
    () => ({
      step,
      goToSelfieStep: () => setStep('selfie'),
      goToNinStep: () => setStep('nin'),
    }),
    [step]
  );

  return <KycFlowContext.Provider value={value}>{children}</KycFlowContext.Provider>;
}

export function useKycFlow() {
  const ctx = useContext(KycFlowContext);
  if (!ctx) throw new Error('useKycFlow must be used within a KycFlowProvider');
  return ctx;
}
