import * as Location from 'expo-location';

/** Backend also defaults to this if radiusKm is omitted from /listings/nearby — kept explicit here so the UI can display it. */
export const DEFAULT_NEARBY_RADIUS_KM = 5;

export interface DeviceLocation {
  lat: number;
  lng: number;
  label: string | null;
}

/** Best-effort — returns null on denied permission or any failure, never throws. */
export async function getDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    // Prefer the OS's own cached last-fix — near-instant, no GPS wait. Only fall back to a fresh
    // fix when nothing's cached yet (e.g. the very first grant on this device).
    const cached = await Location.getLastKnownPositionAsync();
    const position = cached ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const { latitude: lat, longitude: lng } = position.coords;

    let label: string | null = null;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (place) {
        console.log("DEVICE LOCATION", lat, lng, place);

        label = [place.district ?? place.subregion, place.city ?? place.region].filter(Boolean).join(', ');
      }
    } catch {
      // Reverse geocoding is decoration on top of the coordinates — never block on it.
    }

    return { lat, lng, label };
  } catch {
    return null;
  }
}
