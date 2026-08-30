import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';


export async function registerForPushNotificationsAsync(): Promise<string> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    throw new Error('Must use a physical device for push notifications.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permission not granted to register for push notifications.');
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error('EAS project ID not found — run `eas init` before requesting a push token.');
  }

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log("PUSH TOKEN", projectId, pushToken)
  return pushToken;
}
