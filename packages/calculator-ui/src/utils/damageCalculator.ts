/**
 * Damage calculator utilities that wrap the calculator-core package
 *
 * This provides UI-friendly functions for calculating weapon damage
 * using the accurate game formulas from the calculator package.
 */

import type {
  PrecomputedDataV2,
  ARResult,
  AffinityData,
} from '../../../calculator-core/dist/client.js';
import {
  calculateARV2,
  getScalingGrade as getScalingGradeFromValue,
  resolveWeaponAtLevel,
  calculateGuardStatsV2,
} from '../../../calculator-core/dist/client.js';
import type {
  CharacterStats,
  StatConfig,
  OptimalStats,
  WeaponListItem,
  CalculatedWeapon,
  ScalingGrade,
  Affinity,
} from '../types.js';
import type { SolverOptimizationMode } from '../types/solverTypes.js';
import type { PrecomputedAowData } from '../data/index.js';
import { toCalculatorStats, getCategoryName, BUFFABLE_AFFINITIES } from '../types.js';
import { getWeaponDamageTypes, getWeaponTrueCombos, hasUniqueAttacks } from '../data/index.js';
import { solve } from './solver.js';
import { createObjective } from './solverObjectives.js';

// ============================================================================
// AR Calculation
// ============================================================================

/**
 * Calculate AR for a weapon with the given stats
 */
export function calculateWeaponAR(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number,
  stats: CharacterStats,
  options: { twoHanding?: boolean; ignoreRequirements?: boolean } = {}
): ARResult | null {
  const calcStats = toCalculatorStats(stats);
  return calculateARV2(data, weaponName, affinity, upgradeLevel, calcStats, {
    twoHanding: options.twoHanding ?? false,
    ignoreRequirements: options.ignoreRequirements ?? false,
  });
}

/**
 * Check if character meets weapon requirements
 */
export function meetsRequirements(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  stats: CharacterStats,
  twoHanding: boolean = false
): boolean {
  const weapon = data.weapons[weaponName];
  if (!weapon) return false;

  // Two-handing gives 1.5x strength
  const effectiveStr = twoHanding ? Math.floor(stats.str * 1.5) : stats.str;

  return (
    effectiveStr >= weapon.requirements.strength &&
    stats.dex >= weapon.requirements.dexterity &&
    stats.int >= weapon.requirements.intelligence &&
    stats.fai >= weapon.requirements.faith &&
    stats.arc >= weapon.requirements.arcane
  );
}

// ============================================================================
// Weapon List Building
// ============================================================================

/**
 * Build a list of all weapons with their data at a specific upgrade level
 * This creates the flattened weapon list used by the UI
 */
export function buildWeaponList(
  data: PrecomputedDataV2,
  upgradeLevel: number | 'max' = 'max'
): WeaponListItem[] {
  const weapons: WeaponListItem[] = [];

  for (const [name, weapon] of Object.entries(data.weapons)) {
    for (const [affinity, affinityData] of Object.entries(weapon.affinities)) {
      // Determine upgrade level
      const maxLevel = weapon.maxUpgradeLevel;
      const level = upgradeLevel === 'max' ? maxLevel : Math.min(upgradeLevel, maxLevel);

      // Resolve weapon at the upgrade level
      const resolved = resolveWeaponAtLevel(data, name, affinity, level);
      if (!resolved) continue;

      // Get scaling grades from raw values
      const scaling = {
        str: getScalingGradeFromValue(resolved.weaponScaling.strength) as ScalingGrade,
        dex: getScalingGradeFromValue(resolved.weaponScaling.dexterity) as ScalingGrade,
        int: getScalingGradeFromValue(resolved.weaponScaling.intelligence) as ScalingGrade,
        fai: getScalingGradeFromValue(resolved.weaponScaling.faith) as ScalingGrade,
        arc: getScalingGradeFromValue(resolved.weaponScaling.arcane) as ScalingGrade,
      };

      // Unique weapons can't have Ashes of War applied (gemMountType !== 2)
      // e.g. torches, moonveil, boss weapons
      // gemMountType: 0/1 = unique weapon with fixed skill, 2 = can mount AoWs
      const isUnique = weapon.gemMountType !== 2;

      // Check if weapon has non-standard attack animations for its class
      const weaponHasUniqueAttacks = hasUniqueAttacks(name);

      // Get primary damage type (singular)
      const types = getWeaponDamageTypes(name);

      // Calculate guard stats at current upgrade level
      const guardResult = calculateGuardStatsV2(data, name, affinity, level);

      weapons.push({
        id: `${name}-${affinity}`,
        name,
        affinity,
        upgradeLevel: level,
        maxUpgradeLevel: maxLevel,
        category: weapon.wepType,
        categoryName: getCategoryName(weapon.wepType),
        wepmotionCategory: weapon.wepmotionCategory ?? 0,
        weight: weapon.weight ?? 0,
        isDualBlade: weapon.isDualBlade,
        isBuffable: (weapon.isEnhance ?? false) && BUFFABLE_AFFINITIES.has(affinity as Affinity),
        criticalValue: weapon.criticalValue ?? 100,
        isUnique,
        hasUniqueAttacks: weaponHasUniqueAttacks,
        requirements: {
          str: weapon.requirements.strength,
          dex: weapon.requirements.dexterity,
          int: weapon.requirements.intelligence,
          fai: weapon.requirements.faith,
          arc: weapon.requirements.arcane,
        },
        baseDamage: {
          physical: resolved.physical?.base ?? 0,
          magic: resolved.magic?.base ?? 0,
          fire: resolved.fire?.base ?? 0,
          lightning: resolved.lightning?.base ?? 0,
          holy: resolved.holy?.base ?? 0,
        },
        scaling,
        rawScaling: {
          str: resolved.weaponScaling.strength,
          dex: resolved.weaponScaling.dexterity,
          int: resolved.weaponScaling.intelligence,
          fai: resolved.weaponScaling.faith,
          arc: resolved.weaponScaling.arcane,
        },
        hasSorceryScaling: resolved.sorceryScaling !== null,
        hasIncantationScaling: resolved.incantationScaling !== null,
        damageType: types[0] ?? '-',
        trueCombos: getWeaponTrueCombos(name, 51), // Default poise threshold of 51
        // Guard stats - all weapons have these (guardResult should never be null if resolved succeeded)
        guardStats: {
          physical: guardResult?.physical ?? 0,
          magic: guardResult?.magic ?? 0,
          fire: guardResult?.fire ?? 0,
          lightning: guardResult?.lightning ?? 0,
          holy: guardResult?.holy ?? 0,
          guardBoost: guardResult?.guardBoost ?? 0,
        },
      });
    }
  }

  return weapons;
}

/**
 * Calculate AR for all weapons in a list
 */
export function calculateWeaponListAR(
  data: PrecomputedDataV2,
  weapons: WeaponListItem[],
  stats: CharacterStats,
  options: { twoHanding?: boolean } = {}
): CalculatedWeapon[] {
  const calcStats = toCalculatorStats(stats);

  return weapons.map(weapon => {
    const arResult = calculateARV2(
      data,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      calcStats,
      { twoHanding: options.twoHanding ?? false }
    );

    // If calculation failed, create empty result
    if (!arResult) {
      return {
        ...weapon,
        arResult: createEmptyARResult(),
        totalAR: 0,
        meetsRequirements: false,
      };
    }

    return {
      ...weapon,
      arResult,
      totalAR: arResult.rounded,
      meetsRequirements: arResult.requirementsMet,
    };
  });
}

// ============================================================================
// Stat Optimization (Advanced Multi-Strategy Solver)
// ============================================================================

/**
 * Find the optimal stat distribution for a weapon to maximize damage.
 *
 * Uses a multi-strategy approach to handle S-curve scaling:
 * 1. For 2 active stats: Exact 2D enumeration (guaranteed optimal)
 * 2. For more stats: Multi-start greedy with breakpoint exploration
 *
 * @param data - Precomputed weapon and curve data
 * @param weaponName - Name of the weapon
 * @param affinity - Weapon affinity (e.g., "Standard", "Heavy")
 * @param upgradeLevel - Weapon upgrade level (0-25)
 * @param statConfigs - Configuration for each stat (min, max, locked values)
 * @param options - Optional parameters
 * @param options.twoHanding - Whether the weapon is two-handed
 * @param options.pointsBudget - Maximum number of stat points to allocate above base stats.
 *                                If undefined, allocates until all unlocked stats reach their max.
 *                                Budget should equal (current total stats - base stats total).
 * @returns Object containing optimal stats and resulting damage
 *
 * @example
 * // Optimize for a Level 100 character (80 points above base)
 * const result = findOptimalStats(data, "Uchigatana", "Keen", 25, statConfigs, {
 *   twoHanding: false,
 *   pointsBudget: 80
 * });
 */
export function findOptimalStats(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number,
  statConfigs: Record<string, StatConfig>,
  options: {
    twoHanding?: boolean;
    pointsBudget?: number;
    optimizationMode?: SolverOptimizationMode;
    aowData?: PrecomputedAowData | null;
    aowName?: string | null;
  } = {}
): OptimalStats {
  const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;
  const unlockedStats = damageStats.filter(stat => !statConfigs[stat].locked);

  // Build base stats from locked values or minimums
  const baseStats: CharacterStats = {
    vig: statConfigs.vig.locked ? statConfigs.vig.value! : 40,
    mnd: statConfigs.mnd.locked ? statConfigs.mnd.value! : 20,
    end: statConfigs.end.locked ? statConfigs.end.value! : 25,
    str: statConfigs.str.locked ? statConfigs.str.value! : (statConfigs.str.min ?? 10),
    dex: statConfigs.dex.locked ? statConfigs.dex.value! : (statConfigs.dex.min ?? 10),
    int: statConfigs.int.locked ? statConfigs.int.value! : (statConfigs.int.min ?? 10),
    fai: statConfigs.fai.locked ? statConfigs.fai.value! : (statConfigs.fai.min ?? 10),
    arc: statConfigs.arc.locked ? statConfigs.arc.value! : (statConfigs.arc.min ?? 10),
  };

  // If all stats locked, just calculate with current values
  if (unlockedStats.length === 0) {
    const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, baseStats, options);
    return {
      stats: baseStats,
      damage: result?.rounded ?? 0,
    };
  }

  // Get weapon data
  const weapon = data.weapons[weaponName];
  if (!weapon) {
    return { stats: baseStats, damage: 0 };
  }

  // Build requirement map
  const reqMap: Record<string, number> = {
    str: weapon.requirements.strength,
    dex: weapon.requirements.dexterity,
    int: weapon.requirements.intelligence,
    fai: weapon.requirements.faith,
    arc: weapon.requirements.arcane,
  };

  // Initialize stats meeting requirements
  const startStats = { ...baseStats };
  for (const stat of unlockedStats) {
    const req = reqMap[stat];
    const effectiveReq = (stat === 'str' && options.twoHanding) ? Math.ceil(req / 1.5) : req;
    const max = statConfigs[stat].max ?? 99;
    if (startStats[stat as keyof CharacterStats] < effectiveReq && effectiveReq <= max) {
      startStats[stat as keyof CharacterStats] = effectiveReq;
    }
  }

  // Calculate points used by baseStats (before requirements)
  let baseStatsSum = 0;
  for (const stat of unlockedStats) {
    baseStatsSum += baseStats[stat as keyof CharacterStats];
  }

  // Calculate points used by startStats (after requirements adjustment)
  let startStatsSum = 0;
  for (const stat of unlockedStats) {
    startStatsSum += startStats[stat as keyof CharacterStats];
  }

  // Determine which stats to use as starting point and calculate budget
  let solverStartStats = startStats;
  let pointsBudget: number;
  let requirementsExceedBudget = false;

  if (options.pointsBudget !== undefined) {
    // Subtract locked damage stats' cost from budget (they consume part of the total budget)
    let lockedStatsCost = 0;
    for (const stat of damageStats) {
      if (statConfigs[stat].locked) {
        lockedStatsCost += baseStats[stat as keyof CharacterStats];
      }
    }
    const effectiveBudget = options.pointsBudget - lockedStatsCost;

    if (startStatsSum > effectiveBudget) {
      // Requirements exceed budget - start from baseStats and optimize with available budget
      requirementsExceedBudget = true;
      solverStartStats = baseStats;
      const availableToAdd = effectiveBudget - baseStatsSum;

      // Calculate max possible from baseStats
      let pointsToMaxFromBase = 0;
      for (const stat of unlockedStats) {
        const max = statConfigs[stat].max ?? 99;
        pointsToMaxFromBase += (max - baseStats[stat as keyof CharacterStats]);
      }

      pointsBudget = Math.max(0, Math.min(pointsToMaxFromBase, availableToAdd));
    } else {
      // Requirements fit within budget - start from startStats
      const availableToAdd = effectiveBudget - startStatsSum;

      // Calculate max possible from startStats
      let pointsToMax = 0;
      for (const stat of unlockedStats) {
        const max = statConfigs[stat].max ?? 99;
        pointsToMax += (max - startStats[stat as keyof CharacterStats]);
      }

      pointsBudget = Math.max(0, Math.min(pointsToMax, availableToAdd));
    }
  } else {
    // No budget constraint - allocate to max
    let pointsToMax = 0;
    for (const stat of unlockedStats) {
      const max = statConfigs[stat].max ?? 99;
      pointsToMax += (max - startStats[stat as keyof CharacterStats]);
    }
    pointsBudget = pointsToMax;
  }

  if (pointsBudget <= 0) {
    const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, solverStartStats, options);
    return { stats: solverStartStats, damage: result?.rounded ?? 0 };
  }

  // Check if this is a catalyst (has spell scaling) - used for breakpoint extraction
  const affinityData = weapon.affinities[affinity];
  const isSorceryCatalyst = affinityData?.sorceryScaling !== null;
  const isIncantCatalyst = affinityData?.incantationScaling !== null;
  const isCatalyst = isSorceryCatalyst || isIncantCatalyst;

  // Extract per-stat breakpoints from curve data (much more efficient than generic breakpoints)
  const statBreakpoints = extractStatBreakpoints(data, affinityData, unlockedStats, isCatalyst);

  // Determine optimization mode
  // Default: SP for catalysts, AR for everything else
  const mode = options.optimizationMode ?? (isCatalyst ? 'SP' : 'AR');

  // Create objective function using factory
  // When requirements can't be met, optimize with ignoreRequirements=true so points
  // get allocated to scaling stats (solver "plans ahead" for when requirements are met)
  const objective = createObjective(mode, {
    precomputed: data,
    aowData: options.aowData ?? null,
    weaponName,
    affinity,
    upgradeLevel,
    categoryName: getCategoryName(weapon.wepType),
    twoHanding: options.twoHanding ?? false,
    aowName: options.aowName ?? null,
    ignoreRequirements: requirementsExceedBudget,
  });

  // Delegate to composable solver with curve-specific breakpoints
  const solverResult = solve(solverStartStats, unlockedStats, pointsBudget, statConfigs, objective, { statBreakpoints });

  // If we optimized with ignoreRequirements=true, recalculate actual AR with real requirements
  // Otherwise, the solver's AR is already correct
  if (requirementsExceedBudget) {
    const actualResult = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, solverResult.stats, {
      twoHanding: options.twoHanding ?? false,
      ignoreRequirements: false,
    });
    return {
      stats: solverResult.stats,
      damage: actualResult?.rounded ?? 0,
    };
  }

  return solverResult;
}

// ============================================================================
// Utilities
// ============================================================================

/** Map of short stat names to full stat names used in scaling */
const STAT_TO_SCALING_KEY: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
  str: 'strength',
  dex: 'dexterity',
  int: 'intelligence',
  fai: 'faith',
  arc: 'arcane',
};

/**
 * Extract per-stat breakpoints from curve data
 * Each stat may have different curves for different damage types, so we collect
 * all unique breakpoints for each stat.
 *
 * Curve breakpoints are in stageMaxVal[1], [2], [3] (indices 0 and 4 are min/max)
 */
function extractStatBreakpoints(
  data: PrecomputedDataV2,
  affinityData: AffinityData,
  unlockedStats: readonly string[],
  isCatalyst: boolean
): Record<string, number[]> {
  const result: Record<string, Set<number>> = {};

  // Initialize sets for each unlocked stat
  for (const stat of unlockedStats) {
    result[stat] = new Set<number>();
  }

  // Helper to add breakpoints from a curveId
  const addBreakpointsFromCurve = (stat: string, curveId: number) => {
    const curve = data.curves[curveId];
    if (!curve) return;

    // stageMaxVal is [min, bp1, bp2, bp3, max] - we want bp1, bp2, bp3
    const breakpoints = curve.stageMaxVal;
    for (let i = 1; i <= 3; i++) {
      const bp = breakpoints[i];
      // Only add breakpoints that are reasonable stat values (1-99)
      if (bp > 1 && bp <= 99) {
        result[stat].add(bp);
      }
    }
  };

  // Collect curveIds from all damage types
  const damageTypes = ['physical', 'magic', 'fire', 'lightning', 'holy'] as const;

  for (const stat of unlockedStats) {
    const scalingKey = STAT_TO_SCALING_KEY[stat];
    if (!scalingKey) continue;

    // For each damage type, get the curve used by this stat
    for (const dt of damageTypes) {
      const damageData = affinityData[dt];
      if (!((damageData as any)?.scaling)) continue;

      const statScaling = (damageData as any).scaling[scalingKey];
      if (statScaling?.curveId !== undefined) {
        addBreakpointsFromCurve(stat, statScaling.curveId);
      }
    }

    // For catalysts, also check spell scaling curves
    if (isCatalyst) {
      if ((affinityData.sorceryScaling as any)?.scaling) {
        const statScaling = (affinityData.sorceryScaling as any).scaling[scalingKey];
        if (statScaling?.curveId !== undefined) {
          addBreakpointsFromCurve(stat, statScaling.curveId);
        }
      }
      if ((affinityData.incantationScaling as any)?.scaling) {
        const statScaling = (affinityData.incantationScaling as any).scaling[scalingKey];
        if (statScaling?.curveId !== undefined) {
          addBreakpointsFromCurve(stat, statScaling.curveId);
        }
      }
    }
  }

  // Convert sets to sorted arrays
  const finalResult: Record<string, number[]> = {};
  for (const stat of unlockedStats) {
    finalResult[stat] = Array.from(result[stat]).sort((a, b) => a - b);
  }

  return finalResult;
}

/**
 * Create an empty AR result for failed calculations
 */
function createEmptyARResult(): ARResult {
  const emptyDamage = {
    base: 0,
    scaling: 0,
    total: 0,
    rounded: 0,
    perStat: {
      strength: { saturation: 0, scaling: 0, rawScaling: 0 },
      dexterity: { saturation: 0, scaling: 0, rawScaling: 0 },
      intelligence: { saturation: 0, scaling: 0, rawScaling: 0 },
      faith: { saturation: 0, scaling: 0, rawScaling: 0 },
      arcane: { saturation: 0, scaling: 0, rawScaling: 0 },
    },
    displayScaling: {
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      faith: 0,
      arcane: 0,
    },
  };

  const emptyStatus = { base: 0, scaling: 0, total: 0, rounded: 0 };

  return {
    physical: emptyDamage,
    magic: emptyDamage,
    fire: emptyDamage,
    lightning: emptyDamage,
    holy: emptyDamage,
    total: 0,
    rounded: 0,
    poison: emptyStatus,
    scarletRot: emptyStatus,
    bleed: emptyStatus,
    frost: emptyStatus,
    sleep: emptyStatus,
    madness: emptyStatus,
    sorceryScaling: null,
    incantationScaling: null,
    effectiveStats: { strength: 0, dexterity: 0, intelligence: 0, faith: 0, arcane: 0 },
    requirementsMet: false,
  };
}

/**
 * Convert raw scaling value to letter grade
 * Re-exported from calculator for convenience
 */
export function getScalingGrade(rawScaling: number): ScalingGrade {
  return getScalingGradeFromValue(rawScaling) as ScalingGrade;
}
