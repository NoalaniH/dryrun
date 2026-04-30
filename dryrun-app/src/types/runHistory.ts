import type { RoutineBlockType } from './dryRun';

export type RunBlockResult = {
  id: string;
  blockId: string;
  libraryItemId?: string;
  title: string;
  type: RoutineBlockType;
  order: number;
  plannedDurationSeconds: number | null;
  actualDurationSeconds: number;
  notes?: string;
};

export type RunSession = {
  id: string;
  dryRunId: string;
  dryRunName: string;
  startedAt: string;
  endedAt: string;
  targetDurationSeconds: number | null;
  totalActualDurationSeconds: number;
  blockResults: RunBlockResult[];
};
