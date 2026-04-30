import type { RoutineBlockType } from '../types/dryRun';

export type BlockSummary = {
  id: string;
  title: string;
  type: RoutineBlockType;
  order: number;
  plannedDurationSeconds: number | null;
  actualDurationSeconds: number;
};

export type RunSummary = {
  runTitle: string;
  targetDurationSeconds: number | null;
  totalActualDurationSeconds: number;
  blocks: BlockSummary[];
};

let current: RunSummary | null = null;

export function setRunSummary(s: RunSummary): void {
  current = s;
}

export function getRunSummary(): RunSummary | null {
  return current;
}

export function clearRunSummary(): void {
  current = null;
}
