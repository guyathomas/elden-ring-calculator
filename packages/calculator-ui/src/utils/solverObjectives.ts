/**
 * Solver objective factory functions
 *
 * Creates objective functions for different optimization modes:
 * - AR: Attack Rating (physical/elemental damage)
 * - SP: Spell Power (sorcery/incantation scaling for catalysts)
 * - AoW: Ash of War total damage
 */

import type { CharacterStats, PrecomputedDataV2 } from '../types.js';
import type { SolverOptimizationMode } from '../types/solverTypes.js';
import type { PrecomputedAowData } from '../data/index.js';
import { calculateAowDamage } from '../data/index.js';
import { calculateWeaponAR } from './damageCalculator.js';

/**
 * Context needed to create an objective function
 */
export interface ObjectiveContext {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData | null;
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  categoryName: string;
  twoHanding: boolean;
  aowName: string | null;
  /** When true, solver optimizes as if requirements are met (for pre-requirement allocation) */
  ignoreRequirements?: boolean;
}

/**
 * An objective function that calculates the value to maximize
 */
export type ObjectiveFunction = (stats: CharacterStats) => number;

/**
 * Create an Attack Rating objective function
 * Maximizes total AR (sum of all damage types)
 */
export function createARObjective(ctx: ObjectiveContext): ObjectiveFunction {
  return (stats: CharacterStats): number => {
    const result = calculateWeaponAR(
      ctx.precomputed,
      ctx.weaponName,
      ctx.affinity,
      ctx.upgradeLevel,
      stats,
      { twoHanding: ctx.twoHanding, ignoreRequirements: ctx.ignoreRequirements }
    );
    return result?.total ?? 0;
  };
}

/**
 * Create a Spell Power objective function
 * Maximizes sorcery or incantation scaling (for catalysts)
 */
export function createSPObjective(ctx: ObjectiveContext): ObjectiveFunction {
  return (stats: CharacterStats): number => {
    const result = calculateWeaponAR(
      ctx.precomputed,
      ctx.weaponName,
      ctx.affinity,
      ctx.upgradeLevel,
      stats,
      { twoHanding: ctx.twoHanding, ignoreRequirements: ctx.ignoreRequirements }
    );
    if (!result) return 0;

    const sorceryVal = result.sorceryScaling?.total ?? 0;
    const incantVal = result.incantationScaling?.total ?? 0;
    return Math.max(sorceryVal, incantVal);
  };
}

/**
 * Create an Ash of War damage objective function
 * Maximizes total damage from the selected Ash of War
 */
export function createAoWObjective(ctx: ObjectiveContext): ObjectiveFunction {
  if (!ctx.aowData || !ctx.aowName) {
    // Fallback to AR if no AoW selected
    return createARObjective(ctx);
  }

  return (stats: CharacterStats): number => {
    const result = calculateAowDamage(ctx.aowData!, ctx.precomputed, {
      weaponName: ctx.weaponName,
      affinity: ctx.affinity,
      upgradeLevel: ctx.upgradeLevel,
      weaponClass: ctx.categoryName,
      strength: stats.str,
      dexterity: stats.dex,
      intelligence: stats.int,
      faith: stats.fai,
      arcane: stats.arc,
      twoHanding: ctx.twoHanding,
      aowName: ctx.aowName!,
      ignoreRequirements: ctx.ignoreRequirements ?? false,
      pvpMode: false,
      showLackingFp: false,
    });

    // Sum total damage across all attacks (motion + bullet damage)
    return result.attacks.reduce((sum, attack) => {
      return sum + attack.motionDamage + attack.bulletDamage;
    }, 0);
  };
}

/**
 * Create an objective function based on the optimization mode
 */
export function createObjective(
  mode: SolverOptimizationMode,
  ctx: ObjectiveContext
): ObjectiveFunction {
  switch (mode) {
    case 'SP':
      return createSPObjective(ctx);
    case 'AoW':
      return createAoWObjective(ctx);
    case 'AR':
    default:
      return createARObjective(ctx);
  }
}
