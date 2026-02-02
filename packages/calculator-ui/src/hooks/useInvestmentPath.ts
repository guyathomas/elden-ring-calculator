/**
 * useInvestmentPath Hook
 *
 * Computes the optimal investment path for a weapon using a greedy algorithm.
 * This hook is shared between OptimalInvestmentChart and WeaponDetail to ensure
 * consistent optimal stat calculations across views.
 */

import { useMemo } from 'react';
import type { CharacterStats, PrecomputedDataV2, WeaponListItem } from '../types';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { selectBestAllocation } from '../utils/solver';
import type { SolverOptimizationMode } from '../types/solverTypes';
import { STAT_KEY_TO_FULL_NAME } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface InvestmentDataPoint {
  pointsInvested: number;
  value: number;
  /** Raw unrounded value for accurate per-point calculations */
  rawValue: number;
  stats: CharacterStats;
  statContributions: Record<string, number>;
  baseDamage: number;
  /** Per-stat point allocation (cumulative from base) */
  statAllocation: Record<string, number>;
}

export interface UseInvestmentPathProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  /** Base stats for the starting class (determines minimum stats and investment baseline) */
  baseStats: CharacterStats;
  twoHanding?: boolean;
  /** Whether to ignore weapon requirements for AR calculation (default: true) */
  ignoreRequirements?: boolean;
  /** Optimization mode: AR (attack rating) or SP (spell power) */
  optimizationMode?: SolverOptimizationMode;
}

export interface UseInvestmentPathResult {
  /** Full investment path data from budget 0 to max */
  investmentData: InvestmentDataPoint[];
  /** Stats that scale for this weapon */
  scalingStats: string[];
  /** Get optimal stats at a specific budget level */
  getOptimalStatsAtBudget: (budget: number) => CharacterStats | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get scaling stats for a weapon (stats that have non-zero scaling)
 */
function getScalingStats(weapon: WeaponListItem): string[] {
  const scalingStats: string[] = [];
  const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;

  for (const stat of damageStats) {
    if (weapon.rawScaling[stat] > 0) {
      scalingStats.push(stat);
    }
  }

  return scalingStats;
}

/**
 * Get stats that contribute to spell scaling for a weapon.
 * Checks sorceryScaling and incantationScaling in precomputed data.
 */
function getSpellScalingStats(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem
): string[] {
  const weaponData = precomputed.weapons[weapon.name];
  const affinityData = weaponData?.affinities[weapon.affinity];
  if (!affinityData) return [];

  const spellScaling = affinityData.sorceryScaling ?? affinityData.incantationScaling;
  if (!spellScaling) return [];

  const statMap: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
    str: 'strength', dex: 'dexterity', int: 'intelligence', fai: 'faith', arc: 'arcane',
  };

  const result: string[] = [];
  for (const [short, long] of Object.entries(statMap)) {
    if (spellScaling[long] !== null) {
      result.push(short);
    }
  }
  return result;
}

/**
 * Calculate stat contributions from AR or SP breakdown
 */
function getStatContributions(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem,
  stats: CharacterStats,
  twoHanding: boolean,
  optimizationMode: SolverOptimizationMode = 'AR'
): { contributions: Record<string, number>; baseDamage: number } {
  const arResult = calculateWeaponAR(
    precomputed,
    weapon.name,
    weapon.affinity,
    weapon.upgradeLevel,
    stats,
    { twoHanding, ignoreRequirements: true }
  );

  if (!arResult) {
    return { contributions: {}, baseDamage: 0 };
  }

  // For SP mode, use spell scaling instead of AR
  if (optimizationMode === 'SP') {
    const sorceryScaling = arResult.sorceryScaling;
    const incantScaling = arResult.incantationScaling;

    const sorceryTotal = sorceryScaling?.total ?? 0;
    const incantTotal = incantScaling?.total ?? 0;
    const spellScaling = sorceryTotal >= incantTotal ? sorceryScaling : incantScaling;

    if (!spellScaling) {
      return { contributions: {}, baseDamage: 100 };
    }

    const baseDamage = spellScaling.base;
    const contributions: Record<string, number> = {};
    for (const shortStat of ['str', 'dex', 'int', 'fai', 'arc']) {
      const fullName = STAT_KEY_TO_FULL_NAME[shortStat] as keyof typeof spellScaling.perStat;
      contributions[shortStat] = spellScaling.perStat[fullName]?.scaling ?? 0;
    }

    return { contributions, baseDamage };
  }

  // AR mode: Sum base damage across all damage types
  const baseDamage =
    arResult.physical.base +
    arResult.magic.base +
    arResult.fire.base +
    arResult.lightning.base +
    arResult.holy.base;

  // Calculate contribution from each stat (scaling portion)
  const contributions: Record<string, number> = {};
  const statMap: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
    str: 'strength',
    dex: 'dexterity',
    int: 'intelligence',
    fai: 'faith',
    arc: 'arcane',
  };

  for (const [shortStat, longStat] of Object.entries(statMap)) {
    let totalContribution = 0;

    // Sum scaling contribution from each damage type
    for (const damageType of ['physical', 'magic', 'fire', 'lightning', 'holy'] as const) {
      const damage = arResult[damageType];
      if (damage.perStat[longStat]) {
        totalContribution += damage.perStat[longStat].scaling;
      }
    }

    contributions[shortStat] = totalContribution;
  }

  return { contributions, baseDamage };
}

// ============================================================================
// Investment Path Computation
// ============================================================================

/**
 * Compute optimal investment path using a greedy algorithm with fresh AR calculations.
 *
 * This matches the solver's `runGreedyWithLookahead` behavior:
 * - Fresh AR calculation at each step to handle two-handing STR rounding
 * - 2-point lookahead when two-handing to capture floor(STR * 1.5) jumps
 */
function computeInvestmentPathGreedy(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem,
  baseStats: CharacterStats,
  scalingStats: string[],
  twoHanding: boolean,
  ignoreRequirements: boolean,
  optimizationMode: SolverOptimizationMode = 'AR'
): InvestmentDataPoint[] {
  const dataPoints: InvestmentDataPoint[] = [];

  // In SP mode, filter to only stats that contribute to spell scaling.
  // This prevents allocating budget to stats like DEX that have AR scaling but no spell scaling.
  let effectiveScalingStats = scalingStats;
  if (optimizationMode === 'SP') {
    const spellStats = getSpellScalingStats(precomputed, weapon);
    if (spellStats.length > 0) {
      effectiveScalingStats = scalingStats.filter(stat => spellStats.includes(stat));
      if (effectiveScalingStats.length === 0) effectiveScalingStats = scalingStats;
    }
  }

  // Calculate max budget
  const maxPointsPerStat = 99;
  const maxBudget = effectiveScalingStats.reduce((sum, stat) => {
    const base = baseStats[stat as keyof CharacterStats];
    return sum + (maxPointsPerStat - base);
  }, 0);
  const effectiveMaxBudget = Math.min(maxBudget, 400);

  // Get minimum stat levels - respect weapon requirements for contributing stats
  const minLevels: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    const base = baseStats[stat as keyof CharacterStats];
    const req = weapon.requirements[stat as keyof typeof weapon.requirements] ?? 0;
    minLevels[stat] = Math.max(base, req);
  }

  // Initialize current levels at base stats
  const currentLevels: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    currentLevels[stat] = baseStats[stat as keyof CharacterStats];
  }

  // Helper to calculate objective value (AR or SP) for current levels
  const getObjectiveValue = (levels: Record<string, number>): number => {
    const stats: CharacterStats = { ...baseStats };
    for (const stat of effectiveScalingStats) {
      stats[stat as keyof CharacterStats] = levels[stat];
    }
    const result = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      stats,
      { twoHanding, ignoreRequirements }
    );

    if (optimizationMode === 'SP') {
      if (!result) return 0;
      const sorceryVal = result.sorceryScaling?.total ?? 0;
      const incantVal = result.incantationScaling?.total ?? 0;
      return Math.max(sorceryVal, incantVal);
    }
    return result?.total ?? 0;
  };

  // Helper to get stat contributions from result
  const getStatContributionsFromResult = (stats: CharacterStats): { contributions: Record<string, number>; baseDamage: number } => {
    return getStatContributions(precomputed, weapon, stats, twoHanding, optimizationMode);
  };

  // Get base objective value (at base stats)
  let currentObjValue = getObjectiveValue(currentLevels);

  // Get base damage (constant throughout)
  const { baseDamage } = getStatContributionsFromResult(baseStats);

  // Add starting point (budget = 0)
  const initialContributions: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    initialContributions[stat] = 0;
  }
  dataPoints.push({
    pointsInvested: 0,
    value: Math.floor(currentObjValue),
    rawValue: currentObjValue,
    stats: { ...baseStats },
    statContributions: initialContributions,
    baseDamage,
    statAllocation: Object.fromEntries(effectiveScalingStats.map(s => [s, 0])),
  });

  // Lookahead config - use 2-point lookahead when two-handing for STR rounding
  const maxLookahead = twoHanding ? 2 : 1;

  let budget = 0;

  // Phase 1: Invest to meet minimum requirements for contributing stats
  {
    const needsInvestment = effectiveScalingStats.some(stat => currentLevels[stat] < minLevels[stat]);

    while (needsInvestment && budget < effectiveMaxBudget) {
      const statsNeedingReqs = effectiveScalingStats.filter(stat => currentLevels[stat] < minLevels[stat]);

      if (statsNeedingReqs.length === 0) break;

      let bestStat: string | null = null;
      let bestGain = -Infinity;

      for (const stat of statsNeedingReqs) {
        const testLevels = { ...currentLevels, [stat]: currentLevels[stat] + 1 };
        const gain = getObjectiveValue(testLevels) - currentObjValue;
        if (gain > bestGain) {
          bestGain = gain;
          bestStat = stat;
        }
      }

      if (!bestStat) break;

      currentLevels[bestStat] += 1;
      currentObjValue = getObjectiveValue(currentLevels);
      budget++;

      const fullStats: CharacterStats = { ...baseStats };
      for (const stat of effectiveScalingStats) {
        fullStats[stat as keyof CharacterStats] = currentLevels[stat];
      }

      const statAllocation: Record<string, number> = {};
      for (const stat of effectiveScalingStats) {
        statAllocation[stat] = currentLevels[stat] - baseStats[stat as keyof CharacterStats];
      }

      const { contributions } = getStatContributionsFromResult(fullStats);

      dataPoints.push({
        pointsInvested: budget,
        value: Math.floor(currentObjValue),
        rawValue: currentObjValue,
        stats: fullStats,
        statContributions: contributions,
        baseDamage,
        statAllocation,
      });
    }
  }

  // Phase 2: Greedy optimization for remaining budget
  while (budget < effectiveMaxBudget) {
    const step = selectBestAllocation({
      stats: effectiveScalingStats,
      currentLevels,
      currentValue: currentObjValue,
      getObjective: getObjectiveValue,
      maxLookahead,
      remainingBudget: effectiveMaxBudget - budget,
    });

    if (!step) {
      break;
    }

    // Apply points incrementally (one at a time) to record progressive values
    for (let p = 1; p <= step.points; p++) {
      currentLevels[step.stat] += 1;
      currentObjValue = getObjectiveValue(currentLevels);
      budget++;

      const fullStats: CharacterStats = { ...baseStats };
      for (const stat of effectiveScalingStats) {
        fullStats[stat as keyof CharacterStats] = currentLevels[stat];
      }

      const statAllocation: Record<string, number> = {};
      for (const stat of effectiveScalingStats) {
        statAllocation[stat] = currentLevels[stat] - baseStats[stat as keyof CharacterStats];
      }

      const { contributions } = getStatContributionsFromResult(fullStats);

      dataPoints.push({
        pointsInvested: budget,
        value: Math.floor(currentObjValue),
        rawValue: currentObjValue,
        stats: fullStats,
        statContributions: contributions,
        baseDamage,
        statAllocation,
      });
    }
  }

  return dataPoints;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useInvestmentPath({
  precomputed,
  weapon,
  baseStats,
  twoHanding = false,
  ignoreRequirements = true,
  optimizationMode = 'AR',
}: UseInvestmentPathProps): UseInvestmentPathResult {
  // Get scaling stats for this weapon
  const scalingStats = useMemo(() => getScalingStats(weapon), [weapon]);

  // Compute investment path data
  const investmentData = useMemo(() => {
    if (scalingStats.length === 0) {
      return [];
    }

    return computeInvestmentPathGreedy(
      precomputed,
      weapon,
      baseStats,
      scalingStats,
      twoHanding,
      ignoreRequirements,
      optimizationMode
    );
  }, [precomputed, weapon, baseStats, scalingStats, twoHanding, ignoreRequirements, optimizationMode]);

  // Create lookup function for optimal stats at a specific budget
  const getOptimalStatsAtBudget = useMemo(() => {
    // Build a Map for O(1) budget lookups
    const budgetToStats = new Map<number, CharacterStats>();
    for (const point of investmentData) {
      budgetToStats.set(point.pointsInvested, point.stats);
    }

    return (budget: number): CharacterStats | null => {
      // Exact match
      if (budgetToStats.has(budget)) {
        return budgetToStats.get(budget)!;
      }

      // Find closest budget that doesn't exceed requested
      let closestBudget = 0;
      for (const point of investmentData) {
        if (point.pointsInvested <= budget && point.pointsInvested > closestBudget) {
          closestBudget = point.pointsInvested;
        }
      }

      return budgetToStats.get(closestBudget) ?? null;
    };
  }, [investmentData]);

  return {
    investmentData,
    scalingStats,
    getOptimalStatsAtBudget,
  };
}
