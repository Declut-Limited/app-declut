import { Platform } from 'react-native';
import { registerDeviceTokens } from '@/api/notifications';

/** POSTs a single Expo push token to /notifications/register-token (now batched — see CLAUDE.md). */
export async function savePushToken(token: string) {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : undefined;
  const { registered } = await registerDeviceTokens([{ token, platform }]);
  return registered;
}
