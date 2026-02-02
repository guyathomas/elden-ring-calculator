/**
 * Brute Force Optimizer Tests
 *
 * Validates the greedy algorithm against brute force ground truth.
 * Tests ensure that:
 * 1. Brute force correctly finds global optima
 * 2. Greedy algorithm matches or closely approximates brute force
 * 3. selectBestAllocation utility works correctly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CharacterStats, StatConfig } from '../types.js';
import { calculateWeaponAR } from './damageCalculator.js';
import { buildPrecomputedDataV2 } from '../../../calculator-core/src/paramBuilder.js';
import type { PrecomputedDataV2 } from '../../../calculator-core/src/types.js';
import {
  bruteForceAtBudget,
  bruteForceOptimalPath,
  selectBestAllocation,
  runGreedyOptimization,
  compareGreedyToBruteForce,
  findFirstDivergence,
  calculateAccuracy,
  type BruteForceConfig,
  type BruteForceResult,
} from './bruteForceOptimizer.js';
import { runGreedyWithLookahead, solveMultiStartGreedy } from './solver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', '..', '..', 'calculator-core', 'param-files');

// ============================================================================
// Test Data
// ============================================================================

let data: PrecomputedDataV2;

// Test weapons that exercise different scaling scenarios
const TEST_WEAPONS = [
  'Moonveil', // STR/DEX/INT - 3 stats
  'Dark Moon Greatsword', // STR/DEX/INT - 3 stats
  'Claymore', // STR/DEX - 2 stats (Quality)
  'Uchigatana', // STR/DEX - 2 stats
];

// Vagabond starting stats (common test baseline)
const VAGABOND_STATS: CharacterStats = {
  vig: 15,
  mnd: 10,
  end: 11,
  str: 14,
  dex: 13,
  int: 9,
  fai: 9,
  arc: 7,
};

// ============================================================================
// Setup
// ============================================================================

beforeAll(() => {
  data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
    weaponFilter: TEST_WEAPONS,
  });
  console.log(`Built data for ${Object.keys(data.weapons).length} weapons`);
}, 30000);

// ============================================================================
// Unit Tests for Brute Force Algorithm
// ============================================================================

describe('bruteForceAtBudget', () => {
  it('should find optimal allocation for simple linear objective', () => {
    // Linear objective: STR counts 2x, DEX counts 1x
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex'],
      maxBudget: 10,
      getObjective: (stats) => 2 * stats.str + stats.dex,
    };

    const result = bruteForceAtBudget(config, 10);

    // All points should go to STR (higher coefficient)
    expect(result.stats.str).toBe(VAGABOND_STATS.str + 10);
    expect(result.stats.dex).toBe(VAGABOND_STATS.dex);
  });

  it('should find optimal allocation for quadratic objective with sweet spot', () => {
    // Quadratic objective: peak at STR=30
    // Budget: 30 points starting from STR=14, DEX=13
    // To reach STR=30, need 16 points. Remaining 14 go to DEX.
    // DEX at 13+14=27 gives more value than overshooting STR past 30
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex'],
      maxBudget: 30,
      getObjective: (stats) => {
        // STR peaks at 30, then diminishes
        const strValue = 100 - Math.pow(stats.str - 30, 2);
        // DEX linear
        const dexValue = stats.dex;
        return strValue + dexValue;
      },
    };

    const result = bruteForceAtBudget(config, 30);

    // With budget of 30 from base STR=14, DEX=13:
    // STR=30 costs 16 points, leaving 14 for DEX -> DEX=27, value = 100 + 27 = 127
    // Check that the optimal is reasonable (should be near the sweet spot)
    expect(result.stats.str).toBeGreaterThanOrEqual(28);
    expect(result.stats.str).toBeLessThanOrEqual(32);
    // Total AR should be near optimal
    expect(result.value).toBeGreaterThan(120);
  });

  it('should respect min stat values (weapon requirements)', () => {
    // Vagabond: STR=14, DEX=13, INT=9
    // Minimums: STR=18, DEX=23, INT=23
    // Cost to reach mins: (18-14)+(23-13)+(23-9) = 4+10+14 = 28 points
    // With budget 30, we have 2 extra points beyond minimums
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex', 'int'],
      maxBudget: 30, // Enough to reach all minimums
      getObjective: (stats) => stats.str + stats.dex + stats.int,
      minStatValues: {
        str: 18, // Moonveil STR requirement
        dex: 23, // Moonveil DEX requirement
        int: 23, // Moonveil INT requirement
      },
    };

    const result = bruteForceAtBudget(config, 30);

    // Must meet requirements
    expect(result.stats.str).toBeGreaterThanOrEqual(18);
    expect(result.stats.dex).toBeGreaterThanOrEqual(23);
    expect(result.stats.int).toBeGreaterThanOrEqual(23);
  });

  it('should handle budget=0 correctly', () => {
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex'],
      maxBudget: 0,
      getObjective: (stats) => stats.str + stats.dex,
    };

    const result = bruteForceAtBudget(config, 0);

    // Should return base stats
    expect(result.stats.str).toBe(VAGABOND_STATS.str);
    expect(result.stats.dex).toBe(VAGABOND_STATS.dex);
    expect(result.budget).toBe(0);
  });
});

describe('selectBestAllocation', () => {
  it('should select highest gain stat', () => {
    // STR gives 2 per point, DEX gives 1
    const getObjective = (levels: Record<string, number>) => 2 * levels.str + levels.dex;

    const result = selectBestAllocation({
      stats: ['str', 'dex'],
      currentLevels: { str: 10, dex: 10 },
      currentValue: 30,
      getObjective,
      maxLookahead: 1,
      remainingBudget: 10,
    });

    expect(result).not.toBeNull();
    expect(result!.stat).toBe('str');
    expect(result!.points).toBe(1);
    expect(result!.gain).toBe(2);
  });

  it('should use 2-point lookahead when beneficial', () => {
    // Simulate a scenario where 2-point allocation is clearly better
    // At STR=11: gain for 1pt = 0 (next effective is 12, which rounds to 12)
    // Wait, floor(11/2)*2 = 10, floor(12/2)*2 = 12. So 1pt gives +4.
    // Let's use a different scenario: STR matters only at multiples of 3
    const getObjective = (levels: Record<string, number>) => {
      // STR only counts every 3 levels (simulating a threshold)
      const effectiveStr = Math.floor(levels.str / 3) * 3;
      return effectiveStr * 3 + levels.dex;
    };

    // At STR=10: effective=9, value=9*3+10=37
    // STR 10->11: effective=9, value=37 (no gain)
    // STR 10->12: effective=12, value=12*3+10=46 (gain=9)
    // DEX 10->11: value=9*3+11=38 (gain=1)
    // So 2pt to STR gives avg gain of 4.5, better than 1pt to DEX (1.0)
    const result = selectBestAllocation({
      stats: ['str', 'dex'],
      currentLevels: { str: 10, dex: 10 },
      currentValue: getObjective({ str: 10, dex: 10 }),
      getObjective,
      maxLookahead: 2,
      remainingBudget: 10,
    });

    expect(result).not.toBeNull();
    // Should prefer 2-point STR since avg gain (4.5) > 1-pt DEX gain (1.0)
    expect(result!.stat).toBe('str');
    expect(result!.points).toBe(2);
  });

  it('should return null when no beneficial allocation', () => {
    // Flat objective - no gain
    const getObjective = () => 100;

    const result = selectBestAllocation({
      stats: ['str', 'dex'],
      currentLevels: { str: 10, dex: 10 },
      currentValue: 100,
      getObjective,
      maxLookahead: 1,
      remainingBudget: 10,
    });

    expect(result).toBeNull();
  });

  it('should respect max stat values', () => {
    const getObjective = (levels: Record<string, number>) => levels.str + levels.dex;

    const result = selectBestAllocation({
      stats: ['str', 'dex'],
      currentLevels: { str: 99, dex: 10 }, // STR maxed
      currentValue: 109,
      getObjective,
      maxLookahead: 1,
      remainingBudget: 10,
      maxValues: { str: 99, dex: 99 },
    });

    expect(result).not.toBeNull();
    expect(result!.stat).toBe('dex'); // Can't allocate to STR
  });
});

// ============================================================================
// Integration Tests: Greedy vs Brute Force
// ============================================================================

describe('Greedy vs Brute Force Comparison', () => {
  it('should match brute force for simple 2-stat linear objective', () => {
    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];
    const maxBudget = 30;

    // Linear objective
    const getObjective = (stats: CharacterStats) => 2 * stats.str + stats.dex;

    // Run brute force
    const bfConfig: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
    };
    const bfPath = bruteForceOptimalPath(bfConfig);

    // Run greedy
    const greedyResult = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
    });

    // Compare
    const comparisons = compareGreedyToBruteForce(greedyResult.path, bfPath.path);
    const accuracy = calculateAccuracy(comparisons);

    console.log(`2-stat linear: ${(accuracy.matchRate * 100).toFixed(1)}% match rate`);
    expect(accuracy.matchRate).toBe(1); // Should be perfect for linear
  });

  it('should closely match brute force for Moonveil AR optimization', () => {
    const weaponName = 'Moonveil';
    const affinity = 'Standard';
    const upgradeLevel = 10;
    const maxBudget = 50;

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Moonveil not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex', 'int'];

    const getObjective = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // Weapon requirements
    const reqs = weaponData.requirements;
    const minStatValues: Record<string, number> = {
      str: reqs.strength,
      dex: reqs.dexterity,
      int: reqs.intelligence,
    };

    // Run brute force (limited budget for performance)
    const bfConfig: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
      minStatValues,
    };

    console.time('Brute force (Moonveil, budget=50)');
    const bfPath = bruteForceOptimalPath(bfConfig);
    console.timeEnd('Brute force (Moonveil, budget=50)');

    // Run greedy
    console.time('Greedy (Moonveil, budget=50)');
    const greedyResult = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
      minStatValues,
    });
    console.timeEnd('Greedy (Moonveil, budget=50)');

    // Compare only valid data points (where both have finite values)
    const validComparisons = compareGreedyToBruteForce(greedyResult.path, bfPath.path, 0.5)
      .filter(c => isFinite(c.bruteForceValue) && isFinite(c.greedyValue));

    if (validComparisons.length === 0) {
      console.log('No valid comparisons found');
      return;
    }

    const accuracy = calculateAccuracy(validComparisons);
    const firstDivergence = findFirstDivergence(validComparisons);

    console.log(`Moonveil 3-stat: ${(accuracy.matchRate * 100).toFixed(1)}% match rate (${validComparisons.length} valid points)`);
    console.log(`  Avg value diff: ${accuracy.avgValueDiff.toFixed(2)}`);
    console.log(`  Max value diff: ${accuracy.maxValueDiff.toFixed(2)}`);

    if (firstDivergence) {
      console.log(`  First divergence at budget ${firstDivergence.budget}:`);
      console.log(`    Brute force: STR=${firstDivergence.bruteForceStats.str} DEX=${firstDivergence.bruteForceStats.dex} INT=${firstDivergence.bruteForceStats.int} → ${firstDivergence.bruteForceValue.toFixed(0)}`);
      console.log(`    Greedy: STR=${firstDivergence.greedyStats.str} DEX=${firstDivergence.greedyStats.dex} INT=${firstDivergence.greedyStats.int} → ${firstDivergence.greedyValue.toFixed(0)}`);
      console.log(`    Value diff: ${firstDivergence.valueDiff.toFixed(2)}`);
    }

    // Final values should be close (within 1% of brute force optimal)
    const finalBf = bfPath.path[bfPath.path.length - 1];
    const finalGreedy = greedyResult.path[greedyResult.path.length - 1];
    const finalAccuracy = finalGreedy.value / finalBf.value;

    console.log(`  Final: BF=${finalBf.value.toFixed(0)} vs Greedy=${finalGreedy.value.toFixed(0)} (${(finalAccuracy * 100).toFixed(1)}%)`);

    // Greedy should achieve at least 98% of optimal at the end
    expect(finalAccuracy).toBeGreaterThanOrEqual(0.98);
  });
});

// ============================================================================
// Comparison with solver.ts runGreedyWithLookahead
// ============================================================================

describe('Consistency between solver.ts and bruteForceOptimizer', () => {
  it('should produce same results as runGreedyWithLookahead', () => {
    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];
    const maxBudget = 30;

    const getObjective = (stats: CharacterStats) => stats.str * 2 + stats.dex;

    const statConfigs: Record<string, StatConfig> = {
      str: { min: baseStats.str, max: 99 },
      dex: { min: baseStats.dex, max: 99 },
    };

    // Run solver's greedy
    const solverResult = runGreedyWithLookahead(
      baseStats,
      scalingStats,
      maxBudget,
      statConfigs,
      getObjective
    );

    // Run our greedy
    const ourResult = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
    });

    // Final results should match
    expect(ourResult.finalStats.str).toBe(solverResult.stats.str);
    expect(ourResult.finalStats.dex).toBe(solverResult.stats.dex);
    expect(Math.abs(ourResult.finalValue - solverResult.ar)).toBeLessThan(0.01);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Brute Force Performance', () => {
  it('should complete 2-stat brute force in reasonable time', () => {
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex'],
      maxBudget: 100,
      getObjective: (stats) => stats.str + stats.dex,
    };

    const start = performance.now();
    bruteForceOptimalPath(config);
    const elapsed = performance.now() - start;

    console.log(`2-stat brute force (budget=100): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(1000); // Should be under 1 second
  });

  it('should complete 3-stat brute force in reasonable time', () => {
    const config: BruteForceConfig = {
      baseStats: { ...VAGABOND_STATS },
      scalingStats: ['str', 'dex', 'int'],
      maxBudget: 50, // Lower budget for 3 stats
      getObjective: (stats) => stats.str + stats.dex + stats.int,
    };

    const start = performance.now();
    bruteForceOptimalPath(config);
    const elapsed = performance.now() - start;

    console.log(`3-stat brute force (budget=50): ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(5000); // Should be under 5 seconds
  });
});

// ============================================================================
// Real Weapon Tests (for ground truth validation)
// ============================================================================

describe('Real Weapon Ground Truth', () => {
  it('Moonveil +10: should find optimal STR/DEX/INT allocation at budget 50', () => {
    const weaponName = 'Moonveil';
    const affinity = 'Standard';
    const upgradeLevel = 10;

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Moonveil not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex', 'int'];
    const maxBudget = 50;

    const getObjective = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    const reqs = weaponData.requirements;
    const minStatValues: Record<string, number> = {
      str: reqs.strength,
      dex: reqs.dexterity,
      int: reqs.intelligence,
    };

    // Get brute force optimal at budget 50
    const config: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
      minStatValues,
    };

    const result = bruteForceAtBudget(config, maxBudget);

    console.log(`\nMoonveil +10 @ budget ${maxBudget}:`);
    console.log(`  Optimal: STR=${result.stats.str}, DEX=${result.stats.dex}, INT=${result.stats.int}`);
    console.log(`  AR: ${Math.floor(result.value)}`);

    // Just verify we got a reasonable result
    expect(result.value).toBeGreaterThan(300);
    expect(result.stats.str).toBeGreaterThanOrEqual(reqs.strength);
    expect(result.stats.dex).toBeGreaterThanOrEqual(reqs.dexterity);
    expect(result.stats.int).toBeGreaterThanOrEqual(reqs.intelligence);
  });

  it('Claymore Quality +25: should find optimal STR/DEX allocation', () => {
    const weaponName = 'Claymore';
    const affinity = 'Quality';
    const upgradeLevel = 25;

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Claymore not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];
    const maxBudget = 60;

    const getObjective = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // Get brute force optimal
    const config: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective,
    };

    const result = bruteForceAtBudget(config, maxBudget);

    console.log(`\nClaymore Quality +25 @ budget ${maxBudget}:`);
    console.log(`  Optimal: STR=${result.stats.str}, DEX=${result.stats.dex}`);
    console.log(`  AR: ${Math.floor(result.value)}`);

    // Quality weapons should have balanced STR/DEX
    expect(result.value).toBeGreaterThan(400);
  });

  it('Claymore Quality +25 2H: should find optimal with two-handing bonus', () => {
    const weaponName = 'Claymore';
    const affinity = 'Quality';
    const upgradeLevel = 25;

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Claymore not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];
    const maxBudget = 60;

    // 1H objective
    const getObjective1H = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // 2H objective (with STR bonus)
    const getObjective2H = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: true,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // Get optimal for both
    const config1H: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective: getObjective1H,
    };

    const config2H: BruteForceConfig = {
      baseStats,
      scalingStats,
      maxBudget,
      getObjective: getObjective2H,
    };

    const result1H = bruteForceAtBudget(config1H, maxBudget);
    const result2H = bruteForceAtBudget(config2H, maxBudget);

    console.log(`\nClaymore Quality +25 @ budget ${maxBudget}:`);
    console.log(`  1H Optimal: STR=${result1H.stats.str}, DEX=${result1H.stats.dex} → AR=${Math.floor(result1H.value)}`);
    console.log(`  2H Optimal: STR=${result2H.stats.str}, DEX=${result2H.stats.dex} → AR=${Math.floor(result2H.value)}`);

    // 2H should produce higher AR due to 1.5x STR bonus (effective STR higher)
    // Note: the optimal STR allocation might be lower for 2H since effective STR = floor(1.5 * STR)
    // reaches higher effective values with fewer invested points
    expect(result2H.value).toBeGreaterThan(result1H.value);

    // Both should have reasonable stat allocations
    expect(result1H.stats.str).toBeGreaterThan(20);
    expect(result1H.stats.dex).toBeGreaterThan(20);
    expect(result2H.stats.str).toBeGreaterThan(20);
    expect(result2H.stats.dex).toBeGreaterThan(20);
  });
});

// ============================================================================
// Algorithm Comparison: Solver vs Investment Path vs Brute Force
// ============================================================================

describe('Algorithm Comparison: Solver vs Investment Path vs Brute Force', () => {
  it('compares multi-start greedy (solver) and single-start greedy (investment path) against brute force', () => {
    const weaponName = 'Moonveil';
    const affinity = 'Standard';
    const upgradeLevel = 10;
    const maxBudget = 60; // Reasonable budget for comprehensive comparison

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Moonveil not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex', 'int'];

    const getObjective = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // Weapon requirements
    const reqs = weaponData.requirements;
    const minStatValues: Record<string, number> = {
      str: reqs.strength,
      dex: reqs.dexterity,
      int: reqs.intelligence,
    };

    // Build stat configs for solver
    const statConfigs: Record<string, StatConfig> = {
      str: { min: baseStats.str, max: 99 },
      dex: { min: baseStats.dex, max: 99 },
      int: { min: baseStats.int, max: 99 },
    };

    console.log('\n=== Algorithm Comparison: Moonveil ===');
    console.log(`Vagabond base: STR=${baseStats.str}, DEX=${baseStats.dex}, INT=${baseStats.int}`);
    console.log(`Requirements: STR=${reqs.strength}, DEX=${reqs.dexterity}, INT=${reqs.intelligence}`);
    console.log('');

    // Track results
    const results: Array<{
      budget: number;
      bruteForce: { ar: number; str: number; dex: number; int: number };
      solver: { ar: number; str: number; dex: number; int: number };
      greedy: { ar: number; str: number; dex: number; int: number };
      solverMatch: boolean;
      greedyMatch: boolean;
    }> = [];

    // Run comparison at each budget level
    for (let budget = 0; budget <= maxBudget; budget += 5) {
      // 1. Brute Force (ground truth)
      const bfConfig: BruteForceConfig = {
        baseStats,
        scalingStats,
        maxBudget: budget,
        getObjective,
        minStatValues,
      };
      const bfResult = bruteForceAtBudget(bfConfig, budget);

      // 2. Multi-start greedy (solver)
      const solverResult = solveMultiStartGreedy(
        baseStats,
        scalingStats,
        budget,
        statConfigs,
        getObjective
      );

      // 3. Single-start greedy (investment path algorithm)
      const greedyResult = runGreedyOptimization({
        baseStats,
        scalingStats,
        maxBudget: budget,
        getObjective,
        minStatValues,
      });
      const greedyFinal = greedyResult.path[greedyResult.path.length - 1];

      // Compare
      const solverMatch = Math.abs(solverResult.damage - bfResult.value) < 1;
      const greedyMatch = Math.abs(greedyFinal.value - bfResult.value) < 1;

      results.push({
        budget,
        bruteForce: {
          ar: Math.floor(bfResult.value),
          str: bfResult.stats.str,
          dex: bfResult.stats.dex,
          int: bfResult.stats.int,
        },
        solver: {
          ar: solverResult.damage,
          str: solverResult.stats.str,
          dex: solverResult.stats.dex,
          int: solverResult.stats.int,
        },
        greedy: {
          ar: Math.floor(greedyFinal.value),
          str: greedyFinal.stats.str,
          dex: greedyFinal.stats.dex,
          int: greedyFinal.stats.int,
        },
        solverMatch,
        greedyMatch,
      });
    }

    // Print results table
    console.log('Budget | BruteForce AR | Solver AR | Greedy AR | S=BF? | G=BF?');
    console.log('-------|---------------|-----------|-----------|-------|------');
    for (const r of results) {
      console.log(
        `${r.budget.toString().padStart(6)} | ` +
        `${r.bruteForce.ar.toString().padStart(13)} | ` +
        `${r.solver.ar.toString().padStart(9)} | ` +
        `${r.greedy.ar.toString().padStart(9)} | ` +
        `${r.solverMatch ? '  ✓  ' : '  ✗  '} | ` +
        `${r.greedyMatch ? '  ✓  ' : '  ✗  '}`
      );
    }

    // Print mismatches in detail
    const solverMismatches = results.filter(r => !r.solverMatch);
    const greedyMismatches = results.filter(r => !r.greedyMatch);

    console.log(`\nSolver mismatches: ${solverMismatches.length}/${results.length}`);
    console.log(`Greedy mismatches: ${greedyMismatches.length}/${results.length}`);

    if (solverMismatches.length > 0) {
      console.log('\nSolver mismatch details:');
      for (const m of solverMismatches) {
        console.log(`  Budget ${m.budget}: BF=${m.bruteForce.ar} (${m.bruteForce.str}/${m.bruteForce.dex}/${m.bruteForce.int}) vs Solver=${m.solver.ar} (${m.solver.str}/${m.solver.dex}/${m.solver.int})`);
      }
    }

    if (greedyMismatches.length > 0) {
      console.log('\nGreedy mismatch details:');
      for (const m of greedyMismatches) {
        console.log(`  Budget ${m.budget}: BF=${m.greedy.ar} (${m.bruteForce.str}/${m.bruteForce.dex}/${m.bruteForce.int}) vs Greedy=${m.greedy.ar} (${m.greedy.str}/${m.greedy.dex}/${m.greedy.int})`);
      }
    }

    // Final AR values should be close
    const finalResult = results[results.length - 1];
    const solverAccuracy = finalResult.solver.ar / finalResult.bruteForce.ar;
    const greedyAccuracy = finalResult.greedy.ar / finalResult.bruteForce.ar;

    console.log(`\nFinal budget ${maxBudget}:`);
    console.log(`  Solver accuracy: ${(solverAccuracy * 100).toFixed(2)}%`);
    console.log(`  Greedy accuracy: ${(greedyAccuracy * 100).toFixed(2)}%`);

    // Assertions
    // Solver should be very close to brute force (within 1%)
    expect(solverAccuracy).toBeGreaterThanOrEqual(0.99);
    // Greedy should achieve at least 98% of optimal
    expect(greedyAccuracy).toBeGreaterThanOrEqual(0.98);
  });

  it('documents that Scaling Curves and Investment Path can diverge (by design)', () => {
    // This test documents the expected behavior:
    // - Scaling Curves calculates marginal gains with USER'S CURRENT STATS as baseline
    // - Investment Path calculates marginal gains with OPTIMAL-SO-FAR STATS as baseline
    // These can recommend different "best" stats at the same budget level

    const weaponName = 'Moonveil';
    const affinity = 'Standard';
    const upgradeLevel = 10;

    const weaponData = data.weapons[weaponName];
    if (!weaponData) {
      console.log('Moonveil not found in test data, skipping');
      return;
    }

    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex', 'int'];

    const getObjective = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, {
        twoHanding: false,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    // Weapon requirements
    const reqs = weaponData.requirements;
    const minStatValues: Record<string, number> = {
      str: reqs.strength,
      dex: reqs.dexterity,
      int: reqs.intelligence,
    };

    // User's "current" stats: just meeting Moonveil requirements
    const userCurrentStats: CharacterStats = {
      ...baseStats,
      str: Math.max(baseStats.str, reqs.strength),
      dex: Math.max(baseStats.dex, reqs.dexterity),
      int: Math.max(baseStats.int, reqs.intelligence),
    };

    // Run greedy to get optimal path
    const greedyResult = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget: 120,
      getObjective,
      minStatValues,
    });

    console.log('\n=== Scaling Curves vs Investment Path Divergence ===');
    console.log(`User current stats: STR=${userCurrentStats.str}, DEX=${userCurrentStats.dex}, INT=${userCurrentStats.int}`);
    console.log('');

    // Find a budget level where the recommendations might differ
    // Look at budget 100-120 where stats are getting higher
    console.log('Budget | Greedy Next Stat | Scaling Curves Best Stat');
    console.log('-------|------------------|-------------------------');

    for (let budget = 100; budget <= 120; budget++) {
      const pathPoint = greedyResult.path[budget];
      const prevPoint = greedyResult.path[budget - 1];

      if (!pathPoint || !prevPoint) continue;

      // What stat did greedy choose?
      let greedyChoice = '-';
      for (const stat of scalingStats) {
        if (pathPoint.stats[stat as keyof CharacterStats] > prevPoint.stats[stat as keyof CharacterStats]) {
          greedyChoice = stat.toUpperCase();
          break;
        }
      }

      // What would Scaling Curves recommend?
      // (marginal gain from USER'S current stats, not optimal path)
      let scalingBest = '-';
      let scalingBestGain = -Infinity;
      for (const stat of scalingStats) {
        const level = userCurrentStats[stat as keyof CharacterStats] + budget;
        if (level > 99) continue;

        const beforeStats = { ...userCurrentStats, [stat]: level - 1 };
        const afterStats = { ...userCurrentStats, [stat]: level };
        const gain = getObjective(afterStats) - getObjective(beforeStats);

        if (gain > scalingBestGain) {
          scalingBestGain = gain;
          scalingBest = stat.toUpperCase();
        }
      }

      const match = greedyChoice === scalingBest;
      console.log(`${budget.toString().padStart(6)} | ${greedyChoice.padStart(16)} | ${scalingBest.padStart(23)} ${match ? '' : '← DIVERGE'}`);
    }

    // This test PASSES regardless of divergence - it's documenting expected behavior
    expect(true).toBe(true);
  });
});

// ============================================================================
// 2-Point Allocation Bug Tests
// ============================================================================

describe('2-Point Allocation Data Recording', () => {
  it('should record progressive values for 2-point allocations, not duplicates', () => {
    // Use a simple linear objective to make the test predictable
    // When we invest 2 points in STR, budget N should have STR+1, budget N+1 should have STR+2
    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];

    // Linear objective: each point of STR = 10, each point of DEX = 5
    // This should cause 2-point STR allocations to be preferred (avg gain 10 > single DEX gain 5)
    const getObjective = (levels: Record<string, number>): number => {
      return levels.str * 10 + levels.dex * 5;
    };

    const result = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget: 10,
      getObjective: (stats: CharacterStats) => getObjective({
        str: stats.str,
        dex: stats.dex,
      }),
      maxLookahead: 2, // Enable 2-point allocations
    });

    // Check that consecutive budget levels have different stat values when 2-point allocations occur
    let foundDuplicates = false;
    const duplicateDetails: string[] = [];

    for (let i = 1; i < result.path.length - 1; i++) {
      const prev = result.path[i];
      const curr = result.path[i + 1];

      // If stats are identical but budget is different, that's the bug
      const prevStr = prev.stats.str;
      const currStr = curr.stats.str;
      const prevDex = prev.stats.dex;
      const currDex = curr.stats.dex;

      if (prevStr === currStr && prevDex === currDex && prev.budget !== curr.budget) {
        foundDuplicates = true;
        duplicateDetails.push(
          `Budget ${prev.budget} and ${curr.budget} have identical stats: STR=${prevStr}, DEX=${prevDex}`
        );
      }
    }

    if (foundDuplicates) {
      console.log('Found duplicate stat values in consecutive budget levels:');
      duplicateDetails.forEach(d => console.log(`  ${d}`));
    }

    // The bug would cause this to fail
    expect(foundDuplicates).toBe(false);
  });

  it('should record intermediate AR values during 2-point STR allocations for two-handing', () => {
    // When two-handing, 2-point lookahead is used to capture floor(STR * 1.5) jumps
    // Each budget level should have a unique AR value
    const weaponName = 'Claymore';
    const baseStats = { ...VAGABOND_STATS };
    const scalingStats = ['str', 'dex'];

    const getAR = (stats: CharacterStats): number => {
      const result = calculateWeaponAR(data, weaponName, 'Quality', 25, stats, {
        twoHanding: true,
        ignoreRequirements: true,
      });
      return result?.total ?? 0;
    };

    const result = runGreedyOptimization({
      baseStats,
      scalingStats,
      maxBudget: 20,
      getObjective: getAR,
      maxLookahead: 2, // Two-handing lookahead
    });

    // Check for consecutive identical AR values (which would indicate the bug)
    let consecutiveIdenticalValues = 0;
    for (let i = 1; i < result.path.length; i++) {
      const prev = result.path[i - 1];
      const curr = result.path[i];

      if (Math.abs(prev.value - curr.value) < 0.001 && prev.budget !== curr.budget) {
        consecutiveIdenticalValues++;
        console.log(`Budget ${prev.budget} and ${curr.budget} have identical AR: ${prev.value}`);
      }
    }

    // With proper implementation, each budget level should have a different AR
    // (or at least different stats)
    console.log(`Found ${consecutiveIdenticalValues} consecutive identical AR values`);

    // Allow some tolerance since AR might plateau at high levels, but should be rare
    expect(consecutiveIdenticalValues).toBeLessThanOrEqual(2);
  });
});
