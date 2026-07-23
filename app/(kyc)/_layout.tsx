import { Stack } from 'expo-router';
import { KycFlowProvider } from '@/context/KycFlowContext';

// gestureEnabled: false — this chain is mandatory and not skippable (see
// CLAUDE.md), so the iOS swipe-back gesture is disabled on every screen here.
export default function KycLayout() {
  return (
    <KycFlowProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
    </KycFlowProvider>
  );
}
