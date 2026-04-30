import AsyncStorage from '@react-native-async-storage/async-storage';
import { DryRun } from '../types/dryRun';

const KEY = 'dryrun:runs';

async function loadAll(): Promise<DryRun[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as DryRun[]) : [];
}

export async function loadAllDryRuns(): Promise<DryRun[]> {
  return loadAll();
}

export async function loadDryRunById(id: string): Promise<DryRun | null> {
  const all = await loadAll();
  return all.find((r) => r.id === id) ?? null;
}

export async function saveDryRun(run: DryRun): Promise<void> {
  const all = await loadAll();
  const idx = all.findIndex((r) => r.id === run.id);
  if (idx >= 0) {
    all[idx] = run;
  } else {
    all.push(run);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deleteDryRun(id: string): Promise<void> {
  const all = await loadAll();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((r) => r.id !== id)));
}
