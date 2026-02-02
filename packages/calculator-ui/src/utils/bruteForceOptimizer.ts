/**
 * Brute Force Optimizer
 *
 * Exhaustively enumerates all valid stat allocations to find the true optimal.
 * Used as ground truth for validating greedy algorithms.
 *
 * Complexity: O(C(budget + k - 1, k - 1)) where k = number of stats
 * For budget=100 and k=3: ~5,000 combinations
 * For budget=200 and k=3: ~20,000 combinations
 */

import type { CharacterStats } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface BruteForceResult {
  /** Optimal stat allocation at this budget */
  stats: CharacterStats;
  /** Optimal objective value (AR, SP, etc.) */
  value: number;
  /** Points invested at this level */
  budget: number;
}

export interface BruteForcePathResult {
  /** Results at each budget level */
  path: BruteForceResult[];
  /** Statistics about the computation */
  stats: {
    totalCombinations: number;
    totalTime: number;
  };
}

export interface BruteForceConfig {
  /** Base stats (starting point) */
  baseStats: CharacterStats;
  /** Stats that can be optimized */
  scalingStats: string[];
  /** Maximum budget to compute */
  maxBudget: number;
  /** Objective function: (stats) => value to maximize */
  getObjective: (stats: CharacterStats) => number;
  /** Optional maximum stat value (default: 99) */
  maxStatValue?: number;
  /** Optional minimum stat values per stat (e.g., weapon requirements) */
  minStatValues?: Record<string, number>;
}

// ============================================================================
// Greedy Step Interface (for algorithm extraction)
// ============================================================================

export interface GreedyStep {
  /** Which stat to invest in */
  stat: string;
  /** How many points to allocate (1 or 2 for lookahead) */
  points: number;
  /** Expected gain per point */
  gain: number;
}

export interface SelectBestAllocationConfig {
  /** Stats that can be optimized */
  stats: string[];
  /** Current stat levels */
  currentLevels: Record<string, number>;
  /** Current objective value */
  currentValue: number;
  /** Objective function */
  getObjective: (levels: Record<string, number>) => number;
  /** Maximum lookahead (1 or 2) */
  maxLookahead: number;
  /** Remaining budget */
  remainingBudget: number;
  /** Maximum stat values per stat */
  maxValues?: Record<string, number>;
  /** Early termination threshold for gains */
  minGainThreshold?: number;
}

// ============================================================================
// Core Brute Force Algorithm
// ============================================================================

/**
 * Find optimal allocation for a single budget level using brute force enumeration.
 *
 * Enumerates all valid combinations where:
 * - sum of (stat[i] - base[i]) = budget
 * - min[i] <= stat[i] <= max[i] for all stats
 *
 * Note: If budget is less than the cost to reach all minimums, returns base stats
 * with bestValue = -Infinity (infeasible allocation).
 */
export function bruteForceAtBudget(
  config: BruteForceConfig,
  budget: number
): BruteForceResult {
  const { baseStats, scalingStats, getObjective, maxStatValue = 99, minStatValues = {} } = config;

  // Get min/max for each stat
  const mins: number[] = [];
  const maxes: number[] = [];
  const bases: number[] = [];

  for (const stat of scalingStats) {
    const base = baseStats[stat as keyof CharacterStats];
    const min = Math.max(base, minStatValues[stat] ?? base);
    const max = maxStatValue;
    mins.push(min);
    maxes.push(max);
    bases.push(base);
  }

  // Calculate minimum budget required to reach all requirements
  let minBudgetRequired = 0;
  for (let i = 0; i < scalingStats.length; i++) {
    minBudgetRequired += mins[i] - bases[i];
  }

  // If budget is less than required, return base stats (infeasible)
  if (budget < minBudgetRequired) {
    // Still try to allocate what we can toward requirements
    const partialStats = { ...baseStats };
    let remaining = budget;
    for (let i = 0; i < scalingStats.length && remaining > 0; i++) {
      const stat = scalingStats[i];
      const base = bases[i];
      const min = mins[i];
      const needed = min - base;
      const allocated = Math.min(needed, remaining);
      partialStats[stat as keyof CharacterStats] = base + allocated;
      remaining -= allocated;
    }
    return {
      stats: partialStats,
      value: getObjective(partialStats),
      budget,
    };
  }

  let bestStats = { ...baseStats };
  let bestValue = -Infinity;
  let combinations = 0;

  const k = scalingStats.length;

  // Recursive enumeration - allocate "extra" points beyond minimums
  const extraBudget = budget - minBudgetRequired;

  const enumerate = (statIndex: number, remaining: number, allocation: number[]) => {
    if (statIndex === k) {
      // Must use all extra points
      if (remaining !== 0) return;

      combinations++;

      // Build stats object (start from mins, add extra allocation)
      const testStats = { ...baseStats };
      for (let i = 0; i < k; i++) {
        testStats[scalingStats[i] as keyof CharacterStats] = mins[i] + allocation[i];
      }

      const value = getObjective(testStats);
      if (value > bestValue) {
        bestValue = value;
        bestStats = testStats;
      }
      return;
    }

    const max = maxes[statIndex];
    const min = mins[statIndex];
    const maxExtra = max - min; // Maximum extra points we can add to this stat

    // For non-last stat: can give 0 to maxExtra points, leave rest for others
    const maxAlloc = Math.min(maxExtra, remaining);

    for (let extra = 0; extra <= maxAlloc; extra++) {
      allocation.push(extra);
      enumerate(statIndex + 1, remaining - extra, allocation);
      allocation.pop();
    }
  };

  enumerate(0, extraBudget, []);

  return {
    stats: bestStats,
    value: bestValue,
    budget,
  };
}

/**
 * Compute optimal allocation path from budget 0 to maxBudget using brute force.
 */
export function bruteForceOptimalPath(config: BruteForceConfig): BruteForcePathResult {
  const startTime = performance.now();
  const path: BruteForceResult[] = [];
  let totalCombinations = 0;

  for (let budget = 0; budget <= config.maxBudget; budget++) {
    const result = bruteForceAtBudget(config, budget);
    path.push(result);
    totalCombinations++; // Approximate, actual combinations are per-budget
  }

  return {
    path,
    stats: {
      totalCombinations,
      totalTime: performance.now() - startTime,
    },
  };
}

// ============================================================================
// Shared Selection Logic (extracted from solver.ts and OptimalInvestmentChart.tsx)
// ============================================================================

/**
 * Select the best stat allocation for the current step.
 * This is the core greedy selection logic shared between solver.ts and OptimalInvestmentChart.tsx.
 *
 * Returns the best stat to invest in and how many points (1 or 2 with lookahead).
 * Returns null if no beneficial allocation is possible.
 */
export function selectBestAllocation(config: SelectBestAllocationConfig): GreedyStep | null {
  const {
    stats,
    currentLevels,
    currentValue,
    getObjective,
    maxLookahead,
    remainingBudget,
    maxValues = {},
    minGainThreshold = 0.01,
  } = config;

  let bestStat: string | null = null;
  let bestGain = 0;
  let bestPoints = 1;

  for (const stat of stats) {
    const currentLevel = currentLevels[stat];
    const maxLevel = maxValues[stat] ?? 99;

    // Try 1-point allocation
    if (currentLevel < maxLevel && remainingBudget >= 1) {
      const testLevels = { ...currentLevels, [stat]: currentLevel + 1 };
      const gain = getObjective(testLevels) - currentValue;
      if (gain > bestGain) {
        bestGain = gain;
        bestStat = stat;
        bestPoints = 1;
      }
    }

    // Try 2-point allocation (for 2H STR floor(1.5x) rounding)
    if (currentLevel + 1 < maxLevel && remainingBudget >= 2 && maxLookahead >= 2) {
      const testLevels = { ...currentLevels, [stat]: currentLevel + 2 };
      const gain2 = getObjective(testLevels) - currentValue;
      // Only prefer 2-point if average gain per point is better
      // This matches solver's: gain2 > bestGain * maxLookahead * 0.9
      if (gain2 > bestGain * maxLookahead * 0.9) {
        const avgGainPer = gain2 / 2;
        if (avgGainPer > bestGain) {
          bestGain = avgGainPer;
          bestStat = stat;
          bestPoints = 2;
        }
      }
    }
  }

  // Early termination if no progress
  if (bestGain <= minGainThreshold || bestStat === null) {
    return null;
  }

  return {
    stat: bestStat,
    points: bestPoints,
    gain: bestGain,
  };
}

/**
 * Run greedy optimization with the shared selection logic.
 * This function demonstrates how to use selectBestAllocation.
 */
export function runGreedyOptimization(config: {
  baseStats: CharacterStats;
  scalingStats: string[];
  maxBudget: number;
  getObjective: (stats: CharacterStats) => number;
  maxLookahead?: number;
  minStatValues?: Record<string, number>;
}): { path: BruteForceResult[]; finalStats: CharacterStats; finalValue: number } {
  const {
    baseStats,
    scalingStats,
    maxBudget,
    getObjective,
    maxLookahead = 2,
    minStatValues = {},
  } = config;

  const path: BruteForceResult[] = [];

  // Initialize at base stats
  const currentLevels: Record<string, number> = {};
  for (const stat of scalingStats) {
    currentLevels[stat] = baseStats[stat as keyof CharacterStats];
  }

  // Build full stats object from levels
  const buildStats = (levels: Record<string, number>): CharacterStats => {
    const stats = { ...baseStats };
    for (const stat of scalingStats) {
      stats[stat as keyof CharacterStats] = levels[stat];
    }
    return stats;
  };

  // Wrapper for objective that takes Record<string, number>
  const getObjectiveFromLevels = (levels: Record<string, number>): number => {
    return getObjective(buildStats(levels));
  };

  let currentValue = getObjective(buildStats(currentLevels));
  let budget = 0;

  // Record starting point
  path.push({
    stats: buildStats(currentLevels),
    value: currentValue,
    budget: 0,
  });

  // Phase 1: Meet minimum requirements first
  for (const stat of scalingStats) {
    const minLevel = minStatValues[stat] ?? baseStats[stat as keyof CharacterStats];
    while (currentLevels[stat] < minLevel && budget < maxBudget) {
      currentLevels[stat]++;
      budget++;
      currentValue = getObjectiveFromLevels(currentLevels);
      path.push({
        stats: buildStats(currentLevels),
        value: currentValue,
        budget,
      });
    }
  }

  // Phase 2: Greedy optimization
  while (budget < maxBudget) {
    const step = selectBestAllocation({
      stats: scalingStats,
      currentLevels,
      currentValue,
      getObjective: getObjectiveFromLevels,
      maxLookahead,
      remainingBudget: maxBudget - budget,
    });

    if (!step) break;

    // Record each point incrementally (apply one point at a time)
    for (let p = 0; p < step.points; p++) {
      currentLevels[step.stat] += 1;
      currentValue = getObjectiveFromLevels(currentLevels);
      budget++;
      path.push({
        stats: buildStats(currentLevels),
        value: currentValue,
        budget,
      });
    }
  }

  return {
    path,
    finalStats: buildStats(currentLevels),
    finalValue: currentValue,
  };
}

// ============================================================================
// Comparison Utilities
// ============================================================================

export interface ComparisonResult {
  budget: number;
  bruteForceValue: number;
  greedyValue: number;
  bruteForceStats: CharacterStats;
  greedyStats: CharacterStats;
  /** True if greedy matches brute force (within tolerance) */
  matches: boolean;
  /** Difference in value (bruteForce - greedy) */
  valueDiff: number;
  /** Which stat brute force chose vs greedy at this step */
  divergingStat?: string;
}

/**
 * Compare greedy algorithm results against brute force ground truth.
 */
export function compareGreedyToBruteForce(
  greedyPath: BruteForceResult[],
  bruteForcePath: BruteForceResult[],
  tolerance: number = 0.01
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  for (let i = 0; i < Math.min(greedyPath.length, bruteForcePath.length); i++) {
    const greedy = greedyPath[i];
    const bf = bruteForcePath[i];

    const valueDiff = bf.value - greedy.value;
    const matches = Math.abs(valueDiff) <= tolerance;

    // Find which stat diverged
    let divergingStat: string | undefined;
    if (!matches) {
      for (const stat of ['str', 'dex', 'int', 'fai', 'arc'] as const) {
        if (bf.stats[stat] !== greedy.stats[stat]) {
          divergingStat = stat;
          break;
        }
      }
    }

    results.push({
      budget: greedy.budget,
      bruteForceValue: bf.value,
      greedyValue: greedy.value,
      bruteForceStats: bf.stats,
      greedyStats: greedy.stats,
      matches,
      valueDiff,
      divergingStat,
    });
  }

  return results;
}

/**
 * Find the first budget level where greedy diverges from brute force.
 */
export function findFirstDivergence(
  comparisons: ComparisonResult[]
): ComparisonResult | null {
  return comparisons.find(c => !c.matches) ?? null;
}

/**
 * Calculate overall accuracy of greedy algorithm.
 */
export function calculateAccuracy(
  comparisons: ComparisonResult[]
): { matchRate: number; avgValueDiff: number; maxValueDiff: number } {
  if (comparisons.length === 0) {
    return { matchRate: 1, avgValueDiff: 0, maxValueDiff: 0 };
  }

  const matches = comparisons.filter(c => c.matches).length;
  const matchRate = matches / comparisons.length;

  const valueDiffs = comparisons.map(c => Math.abs(c.valueDiff));
  const avgValueDiff = valueDiffs.reduce((a, b) => a + b, 0) / valueDiffs.length;
  const maxValueDiff = Math.max(...valueDiffs);

  return { matchRate, avgValueDiff, maxValueDiff };
}
