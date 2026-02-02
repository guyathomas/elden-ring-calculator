/**
 * Composable stat optimization solvers for Elden Ring damage calculator
 *
 * This module provides pure solver functions that can be tested independently
 * and composed together for different optimization strategies.
 */

import type { CharacterStats, StatConfig } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface SolverResult {
  stats: CharacterStats;
  ar: number;
}

export interface OptimalStats {
  stats: CharacterStats;
  damage: number;
}

/**
 * Function signature for AR calculation
 * This is injected into solvers to allow testing with mock functions
 */
export type ARCalculator = (stats: CharacterStats) => number;

/**
 * Function to get min/max bounds for a stat
 */
export type StatBoundsGetter = (stat: string) => [min: number, max: number];

// ============================================================================
// Constants
// ============================================================================

/**
 * Elden Ring scaling curve breakpoints where growth rate changes
 * These are the stat values where CalcCorrectGraph curves have inflection points
 */
export const CURVE_BREAKPOINTS = [15, 16, 18, 20, 25, 30, 40, 43, 45, 50, 58, 60, 80, 99] as const;

// ============================================================================
// 2D Exact Solver
// ============================================================================

/**
 * Exact enumeration solver for 2 active stats
 * Guaranteed optimal solution with O(budget) complexity
 *
 * @param startStats - Initial stat allocation
 * @param unlockedStats - Array of exactly 2 stat names to optimize
 * @param budget - Total points available to allocate
 * @param getMinMax - Function to get [min, max] bounds for a stat
 * @param getAR - Function to calculate AR for given stats
 * @returns Optimal stats and AR value
 */
export function solve2DExact(
  startStats: CharacterStats,
  unlockedStats: readonly string[],
  budget: number,
  getMinMax: StatBoundsGetter,
  getAR: ARCalculator
): OptimalStats {
  if (unlockedStats.length !== 2) {
    throw new Error('solve2DExact requires exactly 2 unlocked stats');
  }

  const [stat1, stat2] = unlockedStats;
  const [min1, max1] = getMinMax(stat1);
  const [min2, max2] = getMinMax(stat2);

  let bestStats = { ...startStats };
  let bestAR = getAR(startStats);

  // Enumerate all valid distributions
  // For each amount allocated to stat1, stat2 gets the remainder
  for (let add1 = 0; add1 <= budget; add1++) {
    const add2 = budget - add1;

    const val1 = Math.min(min1 + add1, max1);
    const val2 = Math.min(min2 + add2, max2);

    // Check if this is a valid allocation (not exceeding budget)
    const actualAdd1 = val1 - min1;
    const actualAdd2 = val2 - min2;
    if (actualAdd1 + actualAdd2 > budget) continue;

    const testStats = {
      ...startStats,
      [stat1]: val1,
      [stat2]: val2,
    };

    const ar = getAR(testStats);
    if (ar > bestAR) {
      bestAR = ar;
      bestStats = testStats;
    }
  }

  return { stats: bestStats, damage: Math.floor(bestAR) };
}

// ============================================================================
// Shared Greedy Selection Logic
// ============================================================================

/**
 * Result of a single greedy allocation step
 */
export interface GreedyStep {
  /** Which stat to invest in */
  stat: string;
  /** How many points to allocate (1 or 2 for lookahead) */
  points: number;
  /** Expected gain per point */
  gain: number;
}

/**
 * Configuration for selecting the best allocation
 */
export interface SelectBestAllocationConfig {
  /** Stats that can be optimized */
  stats: readonly string[];
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
      // This captures floor(1.5x) boundary jumps that 1-point would miss
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

// ============================================================================
// Greedy Solver with Lookahead
// ============================================================================

export interface GreedyOptions {
  /** Maximum points to look ahead (default: 2, for 2H STR rounding) */
  maxLookahead?: number;
  /** Base stats for budget accounting - points used = sum(current - base) */
  baseStats?: CharacterStats;
}

/**
 * Greedy allocation with configurable lookahead
 * Handles the 2H STR rounding issue by looking multiple points ahead
 *
 * @param startStats - Initial stat allocation
 * @param unlockedStats - Array of stat names to optimize
 * @param totalBudget - Total points available to allocate FROM startStats
 * @param statConfigs - Configuration for each stat (min/max bounds)
 * @param getAR - Function to calculate AR for given stats
 * @param options - Optional greedy configuration
 * @returns Final stats and AR value
 */
export function runGreedyWithLookahead(
  startStats: CharacterStats,
  unlockedStats: readonly string[],
  totalBudget: number,
  statConfigs: Record<string, StatConfig>,
  getAR: ARCalculator,
  options: GreedyOptions = {}
): SolverResult {
  const { maxLookahead = 2, baseStats } = options;
  const currentStats = { ...startStats };

  // Calculate points already used from the budget
  // If baseStats is provided, calculate points used to reach startStats from baseStats
  // Otherwise, points used starts at 0 (startStats is the baseline)
  let pointsUsed = 0;
  if (baseStats) {
    for (const stat of unlockedStats) {
      const base = baseStats[stat as keyof CharacterStats];
      const current = currentStats[stat as keyof CharacterStats];
      pointsUsed += Math.max(0, current - base);
    }
  }

  // Build current levels from stats for the shared selection function
  const currentLevels: Record<string, number> = {};
  for (const stat of unlockedStats) {
    currentLevels[stat] = currentStats[stat as keyof CharacterStats];
  }

  // Build max values from stat configs
  const maxValues: Record<string, number> = {};
  for (const stat of unlockedStats) {
    maxValues[stat] = statConfigs[stat].max ?? 99;
  }

  // Create objective function that works with Record<string, number>
  const getObjective = (levels: Record<string, number>): number => {
    const testStats = { ...currentStats };
    for (const stat of unlockedStats) {
      testStats[stat as keyof CharacterStats] = levels[stat];
    }
    return getAR(testStats);
  };

  let currentValue = getAR(currentStats);

  while (pointsUsed < totalBudget) {
    const step = selectBestAllocation({
      stats: unlockedStats,
      currentLevels,
      currentValue,
      getObjective,
      maxLookahead,
      remainingBudget: totalBudget - pointsUsed,
      maxValues,
    });

    // Early termination if no progress
    if (!step) {
      break;
    }

    // Apply best allocation
    currentLevels[step.stat] += step.points;
    currentStats[step.stat as keyof CharacterStats] = currentLevels[step.stat];
    pointsUsed += step.points;
    currentValue = getObjective(currentLevels);
  }

  return { stats: currentStats, ar: currentValue };
}

// ============================================================================
// Multi-Start Greedy Solver
// ============================================================================

export interface MultiStartOptions extends GreedyOptions {
  /** Global breakpoints to explore (default: CURVE_BREAKPOINTS) */
  breakpoints?: readonly number[];
  /** Per-stat breakpoints from curve data (more efficient, overrides global) */
  statBreakpoints?: Record<string, readonly number[]>;
}

/**
 * Generates starting points for multi-start optimization
 * Creates configurations that target curve breakpoints
 *
 * @param startStats - Base stat allocation
 * @param unlockedStats - Stats being optimized
 * @param budget - Total points available
 * @param statConfigs - Configuration for each stat
 * @param statBreakpoints - Per-stat breakpoints from curve data (preferred)
 * @param globalBreakpoints - Fallback breakpoints if per-stat not available
 * @returns Array of starting configurations
 */
export function generateBreakpointStarts(
  startStats: CharacterStats,
  unlockedStats: readonly string[],
  budget: number,
  statConfigs: Record<string, StatConfig>,
  statBreakpoints?: Record<string, readonly number[]>,
  globalBreakpoints: readonly number[] = CURVE_BREAKPOINTS
): CharacterStats[] {
  const startingPoints: CharacterStats[] = [{ ...startStats }];

  // Helper to get breakpoints for a stat
  const getBreakpoints = (stat: string): readonly number[] => {
    return statBreakpoints?.[stat] ?? globalBreakpoints;
  };

  // Add breakpoint-based starting allocations for each pair of stats
  for (let i = 0; i < unlockedStats.length; i++) {
    for (let j = i + 1; j < unlockedStats.length; j++) {
      const stat1 = unlockedStats[i];
      const stat2 = unlockedStats[j];
      const min1 = startStats[stat1 as keyof CharacterStats];
      const min2 = startStats[stat2 as keyof CharacterStats];
      const max1 = statConfigs[stat1].max ?? 99;
      const max2 = statConfigs[stat2].max ?? 99;

      // Use stat-specific breakpoints
      const bp1s = getBreakpoints(stat1);
      const bp2s = getBreakpoints(stat2);

      // Try stat1 breakpoints
      for (const bp of bp1s) {
        if (bp > min1 && bp <= max1) {
          const cost1 = bp - min1;
          if (cost1 <= budget) {
            const remaining = budget - cost1;
            const val2 = Math.min(min2 + remaining, max2);
            startingPoints.push({
              ...startStats,
              [stat1]: bp,
              [stat2]: val2,
            });
          }
        }
      }

      // Try stat2 breakpoints
      for (const bp of bp2s) {
        if (bp > min2 && bp <= max2) {
          const cost2 = bp - min2;
          if (cost2 <= budget) {
            const remaining = budget - cost2;
            const val1 = Math.min(min1 + remaining, max1);
            startingPoints.push({
              ...startStats,
              [stat1]: val1,
              [stat2]: bp,
            });
          }
        }
      }
    }
  }

  return startingPoints;
}

/**
 * Multi-start greedy solver with breakpoint exploration
 * Runs greedy from multiple starting configurations to escape local optima
 *
 * @param startStats - Initial stat allocation
 * @param unlockedStats - Array of stat names to optimize
 * @param budget - Total points available to allocate
 * @param statConfigs - Configuration for each stat (min/max bounds)
 * @param getAR - Function to calculate AR for given stats
 * @param options - Optional configuration
 * @returns Optimal stats and AR value
 */
export function solveMultiStartGreedy(
  startStats: CharacterStats,
  unlockedStats: readonly string[],
  budget: number,
  statConfigs: Record<string, StatConfig>,
  getAR: ARCalculator,
  options: MultiStartOptions = {}
): OptimalStats {
  const { breakpoints = CURVE_BREAKPOINTS, statBreakpoints, ...greedyOptions } = options;

  let globalBestStats = { ...startStats };
  let globalBestAR = getAR(startStats);

  // Generate starting points using per-stat breakpoints if available
  const startingPoints = generateBreakpointStarts(
    startStats,
    unlockedStats,
    budget,
    statConfigs,
    statBreakpoints,
    breakpoints
  );

  // Run greedy from each starting point
  // Pass startStats as baseStats so greedy correctly accounts for points used by the starting point
  for (const sp of startingPoints) {
    const result = runGreedyWithLookahead(sp, unlockedStats, budget, statConfigs, getAR, {
      ...greedyOptions,
      baseStats: startStats,
    });
    if (result.ar > globalBestAR) {
      globalBestAR = result.ar;
      globalBestStats = result.stats;
    }
  }

  return { stats: globalBestStats, damage: Math.floor(globalBestAR) };
}

// ============================================================================
// Unified Solver
// ============================================================================

export interface SolverOptions extends MultiStartOptions {
  /** Force a specific strategy instead of auto-selecting */
  strategy?: '2d-exact' | 'multi-start-greedy';
}

/**
 * Unified solver that automatically selects the best strategy
 *
 * - 2 stats: Uses exact 2D enumeration (guaranteed optimal)
 * - 3+ stats: Uses multi-start greedy with breakpoint exploration
 *
 * @param startStats - Initial stat allocation meeting weapon requirements
 * @param unlockedStats - Array of stat names to optimize
 * @param budget - Total points available to allocate
 * @param statConfigs - Configuration for each stat (min/max bounds)
 * @param getAR - Function to calculate AR for given stats
 * @param options - Optional configuration
 * @returns Optimal stats and damage value
 */
export function solve(
  startStats: CharacterStats,
  unlockedStats: readonly string[],
  budget: number,
  statConfigs: Record<string, StatConfig>,
  getAR: ARCalculator,
  options: SolverOptions = {}
): OptimalStats {
  const { strategy, ...restOptions } = options;

  // Auto-select strategy based on stat count
  const selectedStrategy = strategy ?? (unlockedStats.length === 2 ? '2d-exact' : 'multi-start-greedy');

  if (selectedStrategy === '2d-exact') {
    const getMinMax: StatBoundsGetter = (stat) => {
      const min = startStats[stat as keyof CharacterStats];
      const max = statConfigs[stat].max ?? 99;
      return [min, max];
    };
    return solve2DExact(startStats, unlockedStats, budget, getMinMax, getAR);
  } else {
    return solveMultiStartGreedy(startStats, unlockedStats, budget, statConfigs, getAR, restOptions);
  }
}
