import type { DryRun } from '../types/dryRun';

let currentRunId: string | null = null;
let pendingRun: DryRun | null = null;

export function setSelectedRunId(id: string): void {
  currentRunId = id;
}

export function getSelectedRunId(): string | null {
  return currentRunId;
}

export function setPendingRun(run: DryRun): void {
  pendingRun = run;
  currentRunId = run.id;
}

export function getPendingRun(): DryRun | null {
  return pendingRun;
}

export function clearPendingRun(): void {
  pendingRun = null;
}
