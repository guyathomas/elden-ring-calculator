/**
 * Types for the Build Creator feature
 * Allows users to star weapons and organize them into named builds
 */

export interface Build {
  id: string;            // UUID
  name: string;
  weapons: string[];     // Array of weapon IDs (e.g. "Uchigatana-Keen")
  createdAt: number;
  updatedAt: number;
}

export interface BuildsState {
  builds: Build[];
  activeBuildId: string | null;
}

// localStorage schema with versioning for future migrations
export interface BuildsStorageSchema {
  version: 1;
  data: BuildsState;
}

export const BUILDS_STORAGE_KEY = 'elden-ring-calculator-builds';
export const DEFAULT_BUILD_NAME = 'My Build';
