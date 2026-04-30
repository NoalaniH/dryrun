import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunSession } from '../types/runHistory';

const KEY = 'dryrun:run_sessions';

async function loadAllRunSessions(): Promise<RunSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as RunSession[]) : [];
}

export async function saveRunSession(session: RunSession): Promise<void> {
  const existing = await loadAllRunSessions();
  await AsyncStorage.setItem(KEY, JSON.stringify([...existing, session]));
}

export async function loadRunSessionsForDryRun(dryRunId: string): Promise<RunSession[]> {
  const all = await loadAllRunSessions();
  return all.filter((s) => s.dryRunId === dryRunId);
}

export async function clearRunSessions(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
