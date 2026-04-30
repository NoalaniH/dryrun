import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryItem } from '../types/dryRun';

const KEY = 'dryrun:library';

export async function loadLibrary(): Promise<LibraryItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as LibraryItem[]) : [];
}

export async function saveLibrary(items: LibraryItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}
