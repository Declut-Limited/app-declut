import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Non-sensitive UI convenience data — plain AsyncStorage, not expo-secure-store
 * (that's reserved for bearer credentials, see secureStore.ts).
 */
const RECENT_SEARCHES_KEY = 'declut.recentSearches';
const MAX_RECENT_SEARCHES = 5;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Prepends `term`, de-duping case-insensitively and capping at 5 — returns the updated list. */
export async function addRecentSearch(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return getRecentSearches();

  const existing = await getRecentSearches();
  const deduped = existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...deduped].slice(0, MAX_RECENT_SEARCHES);

  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
}
