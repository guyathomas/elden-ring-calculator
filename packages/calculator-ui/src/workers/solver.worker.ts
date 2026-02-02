/**
 * Web Worker for running stat optimization off the main thread.
 *
 * This worker receives precomputed weapon data once at initialization,
 * then handles solver requests without blocking the UI.
 */

import * as Comlink from 'comlink';
import type { PrecomputedDataV2 } from '../types';
import type { CharacterStats, StatConfig, OptimalStats } from '../types';
import type { SolverOptimizationMode } from '../types/solverTypes';
import type { PrecomputedAowData } from '../data/index';
import { findOptimalStats } from '../utils/damageCalculator';

// Stored references to precomputed data (transferred once at init)
let precomputedData: PrecomputedDataV2 | null = null;
let aowData: PrecomputedAowData | null = null;

export interface FindOptimalStatsParams {
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  statConfigs: Record<string, StatConfig>;
  options?: {
    twoHanding?: boolean;
    pointsBudget?: number;
    optimizationMode?: SolverOptimizationMode;
    aowName?: string | null;
  };
}

/**
 * API exposed to the main thread via Comlink
 */
const solverWorkerApi = {
  /**
   * Initialize the worker with precomputed weapon and AoW data.
   * This should be called once when the app loads.
   */
  initialize(weaponData: PrecomputedDataV2, aowDataParam: PrecomputedAowData | null): void {
    precomputedData = weaponData;
    aowData = aowDataParam;
  },

  /**
   * Check if the worker has been initialized with data
   */
  isInitialized(): boolean {
    return precomputedData !== null;
  },

  /**
   * Find optimal stat distribution for a weapon.
   * Runs the solver algorithm off the main thread.
   */
  findOptimalStats(params: FindOptimalStatsParams): OptimalStats {
    if (!precomputedData) {
      throw new Error('Worker not initialized. Call initialize() first.');
    }

    return findOptimalStats(
      precomputedData,
      params.weaponName,
      params.affinity,
      params.upgradeLevel,
      params.statConfigs,
      {
        ...params.options,
        aowData,
      }
    );
  },
};

export type SolverWorkerApi = typeof solverWorkerApi;

Comlink.expose(solverWorkerApi);
