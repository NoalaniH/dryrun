import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryItem } from '../types/dryRun';

const KEY = 'dryrun:library';

export async function loadLibrary(): Promise<LibraryItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const items = JSON.parse(raw) as LibraryItem[];
  const migrated = items.map((i) => (i.type as string) === 'trick' ? { ...i, type: 'bit' as const } : i);
  if (migrated.some((i, idx) => i !== items[idx])) {
    await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
  }
  return migrated;
}

export async function saveLibrary(items: LibraryItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}
