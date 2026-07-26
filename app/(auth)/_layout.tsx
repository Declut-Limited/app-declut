import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { KycFlowProvider } from '@/context/KycFlowContext';
import { KycSheetOverlay } from '@/components/kyc/KycSheetOverlay';


export default function AuthLayout() {
  return (
    <KycFlowProvider>
      <View style={styles.flex}>
        <Stack screenOptions={{ headerShown: false }} />
        <KycSheetOverlay />
      </View>
    </KycFlowProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
