export type LibraryItemType = 'trick' | 'bit';

export type LibraryItem = {
  id: string;
  title: string;
  type: LibraryItemType;
  defaultDurationSeconds: number | null;
  description: string;
  defaultVibe?: string;
  defaultVerbiage?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RoutineBlockType =
  | 'open'
  | 'trick'
  | 'bit'
  | 'interaction'
  | 'transition'
  | 'close'
  | 'custom';

export type RoutineBlock = {
  id: string;
  title: string;
  type: RoutineBlockType;
  durationSeconds: number | null;
  notes: string;
  vibe?: string;
  verbiage?: string;
  order: number;
  libraryItemId?: string;
};

export type DryRun = {
  id: string;
  title: string;
  targetDurationSeconds: number | null;
  blocks: RoutineBlock[];
  createdAt: string;
  updatedAt: string;
};
