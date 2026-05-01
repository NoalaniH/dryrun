
export type LibraryItem = {
  id: string;
  title: string;
  defaultDurationSeconds: number | null;
  description: string;
  defaultVibe?: string;
  defaultVerbiage?: string;
  defaultCues?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RoutineBlockType =
  | 'open'
  | 'bit'
  | 'interaction'
  | 'transition'
  | 'close'
  | 'custom';

export type RoutineBlock = {
  id: string;
  title: string;
  durationSeconds: number | null;
  notes: string;
  description?: string;
  vibe?: string;
  verbiage?: string;
  cues?: string;
  order: number;
  libraryItemId?: string;
};

export type PromptContent = 'cues' | 'verbiage';
export type PromptAdvance = 'auto' | 'manual';

export type DryRun = {
  id: string;
  title: string;
  targetDurationSeconds: number | null;
  blocks: RoutineBlock[];
  promptEnabled: boolean;
  promptContent: PromptContent;
  promptAdvance: PromptAdvance;
  createdAt: string;
  updatedAt: string;
};
