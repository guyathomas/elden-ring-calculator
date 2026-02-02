/**
 * Solver-specific types for optimization mode selection
 */

import type { PrecomputedDataV2, CharacterStats } from '../types.js';
import type { PrecomputedAowData } from '../data/index.js';

/**
 * Optimization modes for the solver:
 * - AR: Attack Rating (default) - maximize physical/elemental damage
 * - SP: Spell Power - maximize sorcery/incantation scaling (catalysts only)
 * - AoW: Ash of War - maximize total damage from selected Ash of War
 */
export type SolverOptimizationMode = 'AR' | 'SP' | 'AoW';

/**
 * Context needed to create an objective function for the solver
 */
export interface SolverObjectiveContext {
  precomputed: PrecomputedDataV2;
  aowData?: PrecomputedAowData | null;
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  categoryName: string;
  aowName?: string | null;
  twoHanding: boolean;
}

/**
 * A solver objective function with metadata
 */
export interface SolverObjective {
  /** Calculate the objective value for given stats */
  calculate: (stats: CharacterStats) => number;
  /** Human-readable label for this objective */
  label: string;
}
