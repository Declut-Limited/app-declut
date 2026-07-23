import React, { createContext, useContext, useMemo, useState } from 'react';

interface KycFlowContextValue {
  nin: string;
  setNin: (nin: string) => void;
}

const KycFlowContext = createContext<KycFlowContextValue | undefined>(undefined);

/**
 * Holds the NIN entered on screen 2 (verify-nin) in memory just long enough to
 * submit it together with the selfie on screen 3 — the backend takes both in
 * one call (see CLAUDE.md). Deliberately not URL params, so a sensitive
 * national ID number doesn't end up sitting in navigation history.
 */
export function KycFlowProvider({ children }: { children: React.ReactNode }) {
  const [nin, setNin] = useState('');
  const value = useMemo(() => ({ nin, setNin }), [nin]);
  return <KycFlowContext.Provider value={value}>{children}</KycFlowContext.Provider>;
}

export function useKycFlow() {
  const ctx = useContext(KycFlowContext);
  if (!ctx) throw new Error('useKycFlow must be used within a KycFlowProvider');
  return ctx;
}
