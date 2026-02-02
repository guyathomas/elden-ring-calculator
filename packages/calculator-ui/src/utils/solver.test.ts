/**
 * Solver Optimization Tests
 *
 * These tests verify that the stat optimizer correctly finds global optima,
 * especially for weapons with S-curve scaling that causes greedy algorithms
 * to get stuck in local maxima.
 *
 * The test cases are derived from a comprehensive divergence analysis that
 * identified weapons where the greedy algorithm fails to find optimal solutions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findOptimalStats, calculateWeaponAR } from './damageCalculator.js';
import type { StatConfig, CharacterStats } from '../types.js';
import {
  buildPrecomputedDataV2,
  type PrecomputedDataV2,
} from '../../../calculator-core/src/paramBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', '..', '..', 'calculator-core', 'param-files');

// Global test data
let data: PrecomputedDataV2;

// Test case interface for divergence cases
interface DivergenceTestCase {
  weaponName: string;
  affinity: string;
  twoHanding: boolean;
  budget: number;
  // Expected optimal stats (from exhaustive search)
  expectedStats: {
    str?: number;
    dex?: number;
    int?: number;
    fai?: number;
    arc?: number;
  };
  expectedAR: number;
  // For reference: what greedy algorithm produces
  greedyStats?: {
    str?: number;
    dex?: number;
    int?: number;
    fai?: number;
    arc?: number;
  };
  greedyAR?: number;
  // Error tolerance (percent)
  tolerance?: number;
}

// Divergence test cases from the analysis
// These are cases where greedy fails to find the global optimum
const DIVERGENCE_CASES: DivergenceTestCase[] = [
  // Catalysts - S-curve scaling causes greedy to get stuck
  {
    weaponName: 'Gelmir Glintstone Staff',
    affinity: 'Standard',
    twoHanding: false,
    budget: 30,
    expectedStats: { str: 10, int: 28, fai: 30 },
    expectedAR: 114,
    greedyStats: { str: 10, int: 15, fai: 43 },
    greedyAR: 102,
    tolerance: 1, // Allow 1% tolerance
  },
  {
    weaponName: 'Gelmir Glintstone Staff',
    affinity: 'Standard',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 10, int: 28, fai: 30 },
    expectedAR: 114,
    greedyStats: { str: 10, int: 43, fai: 15 },
    greedyAR: 102,
    tolerance: 1,
  },
  {
    weaponName: 'Albinauric Staff',
    affinity: 'Standard',
    twoHanding: false,
    budget: 50,
    expectedStats: { str: 10, int: 28, arc: 44 },
    expectedAR: 90,
    greedyStats: { str: 10, int: 10, arc: 62 },
    greedyAR: 83,
    tolerance: 1,
  },
  {
    weaponName: 'Albinauric Staff',
    affinity: 'Standard',
    twoHanding: true,
    budget: 50,
    expectedStats: { str: 10, int: 28, arc: 44 },
    expectedAR: 90,
    greedyStats: { str: 10, int: 10, arc: 62 },
    greedyAR: 83,
    tolerance: 1,
  },
  {
    weaponName: 'Dragon Communion Seal',
    affinity: 'Standard',
    twoHanding: false,
    budget: 50,
    expectedStats: { fai: 27, arc: 43 },
    expectedAR: 189,
    greedyStats: { fai: 10, arc: 60 },
    greedyAR: 178,
    tolerance: 1,
  },
  {
    weaponName: 'Dragon Communion Seal',
    affinity: 'Standard',
    twoHanding: true,
    budget: 50,
    expectedStats: { fai: 27, arc: 43 },
    expectedAR: 189,
    greedyStats: { fai: 10, arc: 60 },
    greedyAR: 178,
    tolerance: 1,
  },
  {
    weaponName: 'Clawmark Seal',
    affinity: 'Standard',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 20, fai: 30 },
    expectedAR: 125,
    greedyStats: { str: 30, fai: 20 },
    greedyAR: 119,
    tolerance: 1,
  },
  // Quality weapons - 2H bonus causes greedy to undervalue STR
  {
    weaponName: 'Dagger',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 32, dex: 18 },
    expectedAR: 309,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 299,
    tolerance: 1,
  },
  {
    weaponName: 'Warpick',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 34, dex: 17 },
    expectedAR: 418,
    greedyStats: { str: 21, dex: 30 },
    greedyAR: 405,
    tolerance: 1,
  },
  {
    weaponName: 'Club',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 34, dex: 16 },
    expectedAR: 420,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 407,
    tolerance: 1,
  },
  {
    weaponName: 'Curved Club',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 32, dex: 19 },
    expectedAR: 454,
    greedyStats: { str: 21, dex: 30 },
    greedyAR: 440,
    tolerance: 1,
  },
  {
    weaponName: 'Weathered Straight Sword',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 34, dex: 16 },
    expectedAR: 391,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 379,
    tolerance: 1,
  },
  {
    weaponName: 'Short Sword',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 34, dex: 16 },
    expectedAR: 394,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 382,
    tolerance: 1,
  },
  {
    weaponName: 'Short Spear',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 34, dex: 16 },
    expectedAR: 427,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 414,
    tolerance: 1,
  },
  {
    weaponName: 'Longsword',
    affinity: 'Quality',
    twoHanding: true,
    budget: 30,
    expectedStats: { str: 32, dex: 18 },
    expectedAR: 430,
    greedyStats: { str: 20, dex: 30 },
    greedyAR: 417,
    tolerance: 1,
  },
];

/**
 * Create stat config for a given budget
 * Uses weapon requirements as minimums for scaling stats,
 * locks non-scaling stats at their minimum requirements.
 */
function createStatConfig(
  budget: number,
  weapon: string,
  affinity: string,
  expectedStats?: DivergenceTestCase['expectedStats']
): Record<string, StatConfig> {
  // Get weapon requirements from the data
  const weaponData = data.weapons[weapon];
  const reqs = weaponData?.requirements ?? {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    faith: 10,
    arcane: 10,
  };

  // Get weapon scaling info to determine which stats are active
  const affinityData = weaponData?.affinities[affinity];
  const hasScaling = {
    str: (affinityData?.weaponScaling?.strength ?? 0) > 0,
    dex: (affinityData?.weaponScaling?.dexterity ?? 0) > 0,
    int: (affinityData?.weaponScaling?.intelligence ?? 0) > 0,
    fai: (affinityData?.weaponScaling?.faith ?? 0) > 0,
    arc: (affinityData?.weaponScaling?.arcane ?? 0) > 0,
  };

  // Also check spell scaling for catalysts
  if (affinityData?.sorceryScaling || affinityData?.incantationScaling) {
    // For catalysts, check which stats affect spell scaling
    const sorcery = affinityData.sorceryScaling;
    const incant = affinityData.incantationScaling;
    if (sorcery?.strength || incant?.strength) hasScaling.str = true;
    if (sorcery?.dexterity || incant?.dexterity) hasScaling.dex = true;
    if (sorcery?.intelligence || incant?.intelligence) hasScaling.int = true;
    if (sorcery?.faith || incant?.faith) hasScaling.fai = true;
    if (sorcery?.arcane || incant?.arcane) hasScaling.arc = true;
  }

  // If expected stats are provided, use them to determine which stats are active
  // (Lock stats not mentioned in expected)
  const activeStats = expectedStats
    ? new Set(Object.keys(expectedStats).filter(k => expectedStats[k as keyof typeof expectedStats] !== undefined))
    : new Set(Object.keys(hasScaling).filter(k => hasScaling[k as keyof typeof hasScaling]));

  return {
    vig: { value: 10, locked: true },
    mnd: { value: 10, locked: true },
    end: { value: 10, locked: true },
    str: activeStats.has('str')
      ? { min: Math.max(10, reqs.strength), max: 99, locked: false }
      : { value: Math.max(10, reqs.strength), locked: true },
    dex: activeStats.has('dex')
      ? { min: Math.max(10, reqs.dexterity), max: 99, locked: false }
      : { value: Math.max(10, reqs.dexterity), locked: true },
    int: activeStats.has('int')
      ? { min: Math.max(10, reqs.intelligence), max: 99, locked: false }
      : { value: Math.max(10, reqs.intelligence), locked: true },
    fai: activeStats.has('fai')
      ? { min: Math.max(10, reqs.faith), max: 99, locked: false }
      : { value: Math.max(10, reqs.faith), locked: true },
    arc: activeStats.has('arc')
      ? { min: Math.max(10, reqs.arcane), max: 99, locked: false }
      : { value: Math.max(10, reqs.arcane), locked: true },
  };
}

describe('Solver - Divergence Cases', () => {
  beforeAll(() => {
    // Get unique weapon names from test cases
    const weaponNames = [...new Set(DIVERGENCE_CASES.map(tc => tc.weaponName))];

    // Build precomputed data for test weapons
    data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
      weaponFilter: weaponNames,
    });

    console.log(`Built data for ${Object.keys(data.weapons).length} weapons`);
  }, 30000);

  it('should load test data', () => {
    expect(Object.keys(data.weapons).length).toBeGreaterThan(0);
  });

  describe('Catalyst S-curve cases', () => {
    const catalystCases = DIVERGENCE_CASES.filter(tc =>
      tc.weaponName.includes('Staff') || tc.weaponName.includes('Seal')
    );

    it.each(catalystCases.map(tc => [
      `${tc.weaponName} | ${tc.affinity} | ${tc.twoHanding ? '2H' : '1H'} | budget=${tc.budget}`,
      tc
    ]))('%s should find optimal solution', (_, tc) => {
      // Use expected stats to determine which stats are active
      const statConfig = createStatConfig(tc.budget, tc.weaponName, tc.affinity, tc.expectedStats);

      const result = findOptimalStats(
        data,
        tc.weaponName,
        tc.affinity,
        10, // max upgrade level for somber weapons
        statConfig,
        { twoHanding: tc.twoHanding, pointsBudget: tc.budget }
      );

      // Check that we meet or exceed the expected AR (within tolerance)
      const tolerance = tc.tolerance ?? 1;
      const minAcceptableAR = tc.expectedAR * (1 - tolerance / 100);

      expect(result.damage).toBeGreaterThanOrEqual(minAcceptableAR);

      // Log for debugging
      console.log(`${tc.weaponName} ${tc.twoHanding ? '2H' : '1H'}:`);
      console.log(`  Result: STR=${result.stats.str} DEX=${result.stats.dex} INT=${result.stats.int} FAI=${result.stats.fai} ARC=${result.stats.arc} → ${result.damage} AR`);
      console.log(`  Expected: STR=${tc.expectedStats.str ?? '-'} DEX=${tc.expectedStats.dex ?? '-'} INT=${tc.expectedStats.int ?? '-'} FAI=${tc.expectedStats.fai ?? '-'} ARC=${tc.expectedStats.arc ?? '-'} → ${tc.expectedAR} AR`);
    });
  });

  describe('Quality 2H cases', () => {
    const qualityCases = DIVERGENCE_CASES.filter(tc =>
      tc.affinity === 'Quality' && tc.twoHanding
    );

    it.each(qualityCases.map(tc => [
      `${tc.weaponName} | ${tc.affinity} | 2H | budget=${tc.budget}`,
      tc
    ]))('%s should find optimal solution', (_, tc) => {
      // Use expected stats to determine which stats are active
      const statConfig = createStatConfig(tc.budget, tc.weaponName, tc.affinity, tc.expectedStats);

      const result = findOptimalStats(
        data,
        tc.weaponName,
        tc.affinity,
        25, // max upgrade level for standard weapons
        statConfig,
        { twoHanding: tc.twoHanding, pointsBudget: tc.budget }
      );

      // Check that we meet or exceed the expected AR (within tolerance)
      const tolerance = tc.tolerance ?? 1;
      const minAcceptableAR = tc.expectedAR * (1 - tolerance / 100);

      expect(result.damage).toBeGreaterThanOrEqual(minAcceptableAR);

      // Log for debugging
      console.log(`${tc.weaponName} ${tc.twoHanding ? '2H' : '1H'}:`);
      console.log(`  Result: STR=${result.stats.str} DEX=${result.stats.dex} → ${result.damage} AR`);
      console.log(`  Expected: STR=${tc.expectedStats.str ?? '-'} DEX=${tc.expectedStats.dex ?? '-'} → ${tc.expectedAR} AR`);
    });
  });
});

describe('Solver - 3-Stat Accuracy Test', () => {
  beforeAll(() => {
    // Ensure data is loaded
    if (!data || Object.keys(data.weapons).length === 0) {
      const weaponNames = [...new Set(DIVERGENCE_CASES.map(tc => tc.weaponName))];
      data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: weaponNames,
      });
    }
  }, 30000);

  /**
   * Brute-force 3D solver for comparison
   * This is the "ground truth" for testing accuracy
   */
  function bruteForce3D(
    getAR: (s1: number, s2: number, s3: number) => number,
    min1: number, max1: number,
    min2: number, max2: number,
    min3: number, max3: number,
    budget: number
  ): { s1: number; s2: number; s3: number; ar: number } {
    let best = { s1: min1, s2: min2, s3: min3, ar: 0 };

    // Enumerate all valid allocations
    for (let s1 = min1; s1 <= Math.min(min1 + budget, max1); s1++) {
      const remaining1 = budget - (s1 - min1);
      for (let s2 = min2; s2 <= Math.min(min2 + remaining1, max2); s2++) {
        const remaining2 = remaining1 - (s2 - min2);
        const s3 = Math.min(min3 + remaining2, max3);

        const ar = getAR(s1, s2, s3);
        if (ar > best.ar) {
          best = { s1, s2, s3, ar };
        }
      }
    }
    return best;
  }

  it('should match brute-force for Gelmir Glintstone Staff (3 stats: STR, INT, FAI)', () => {
    const weaponName = 'Gelmir Glintstone Staff';
    const affinity = 'Standard';
    const upgradeLevel = 10;
    const budget = 30;

    // Get weapon requirements
    const weaponData = data.weapons[weaponName];
    const reqs = weaponData.requirements;

    // Create stat config with 3 unlocked stats
    const statConfig: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: Math.max(10, reqs.strength), max: 99, locked: false },
      dex: { value: 10, locked: true },
      int: { min: Math.max(10, reqs.intelligence), max: 99, locked: false },
      fai: { min: Math.max(10, reqs.faith), max: 99, locked: false },
      arc: { value: 10, locked: true },
    };

    // Run our solver
    const result = findOptimalStats(data, weaponName, affinity, upgradeLevel, statConfig, {
      twoHanding: false,
      pointsBudget: budget
    });

    // Run brute force
    const getAR = (str: number, int: number, fai: number): number => {
      const stats: CharacterStats = {
        vig: 10, mnd: 10, end: 10,
        str, dex: 10, int, fai, arc: 10
      };
      const arResult = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, { twoHanding: false });
      // Use spell scaling for catalyst
      return Math.max(arResult?.sorceryScaling?.total ?? 0, arResult?.incantationScaling?.total ?? 0);
    };

    const bruteForceResult = bruteForce3D(
      getAR,
      Math.max(10, reqs.strength), 99,
      Math.max(10, reqs.intelligence), 99,
      Math.max(10, reqs.faith), 99,
      budget
    );

    console.log('Gelmir Glintstone Staff (3 stats):');
    console.log(`  Our solver: STR=${result.stats.str} INT=${result.stats.int} FAI=${result.stats.fai} → ${result.damage}`);
    console.log(`  Brute force: STR=${bruteForceResult.s1} INT=${bruteForceResult.s2} FAI=${bruteForceResult.s3} → ${Math.floor(bruteForceResult.ar)}`);

    // Check if we match (or are very close to) brute force
    const accuracy = result.damage / Math.floor(bruteForceResult.ar);
    console.log(`  Accuracy: ${(accuracy * 100).toFixed(2)}%`);

    expect(accuracy).toBeGreaterThanOrEqual(0.99); // 99% accuracy threshold
  });

  it('should match brute-force for Albinauric Staff (3 stats: STR, INT, ARC)', () => {
    const weaponName = 'Albinauric Staff';
    const affinity = 'Standard';
    const upgradeLevel = 10;
    const budget = 50;

    const weaponData = data.weapons[weaponName];
    const reqs = weaponData.requirements;

    const statConfig: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: Math.max(10, reqs.strength), max: 99, locked: false },
      dex: { value: 10, locked: true },
      int: { min: Math.max(10, reqs.intelligence), max: 99, locked: false },
      fai: { value: 10, locked: true },
      arc: { min: Math.max(10, reqs.arcane), max: 99, locked: false },
    };

    const result = findOptimalStats(data, weaponName, affinity, upgradeLevel, statConfig, {
      twoHanding: false,
      pointsBudget: budget
    });

    const getAR = (str: number, int: number, arc: number): number => {
      const stats: CharacterStats = {
        vig: 10, mnd: 10, end: 10,
        str, dex: 10, int, fai: 10, arc
      };
      const arResult = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, { twoHanding: false });
      return Math.max(arResult?.sorceryScaling?.total ?? 0, arResult?.incantationScaling?.total ?? 0);
    };

    const bruteForceResult = bruteForce3D(
      getAR,
      Math.max(10, reqs.strength), 99,
      Math.max(10, reqs.intelligence), 99,
      Math.max(10, reqs.arcane), 99,
      budget
    );

    console.log('Albinauric Staff (3 stats):');
    console.log(`  Our solver: STR=${result.stats.str} INT=${result.stats.int} ARC=${result.stats.arc} → ${result.damage}`);
    console.log(`  Brute force: STR=${bruteForceResult.s1} INT=${bruteForceResult.s2} ARC=${bruteForceResult.s3} → ${Math.floor(bruteForceResult.ar)}`);

    const accuracy = result.damage / Math.floor(bruteForceResult.ar);
    console.log(`  Accuracy: ${(accuracy * 100).toFixed(2)}%`);

    expect(accuracy).toBeGreaterThanOrEqual(0.99);
  });

  it('should match brute-force for Clawmark Seal (2 stats but test with 3 unlocked)', () => {
    const weaponName = 'Clawmark Seal';
    const affinity = 'Standard';
    const upgradeLevel = 10;
    const budget = 30;

    const weaponData = data.weapons[weaponName];
    const reqs = weaponData.requirements;

    // Unlock 3 stats even though only 2 really matter
    const statConfig: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: Math.max(10, reqs.strength), max: 99, locked: false },
      dex: { value: 10, locked: true },
      int: { min: 10, max: 99, locked: false }, // Unlocked but doesn't scale
      fai: { min: Math.max(10, reqs.faith), max: 99, locked: false },
      arc: { value: 10, locked: true },
    };

    const result = findOptimalStats(data, weaponName, affinity, upgradeLevel, statConfig, {
      twoHanding: true,
      pointsBudget: budget
    });

    const getAR = (str: number, int: number, fai: number): number => {
      const stats: CharacterStats = {
        vig: 10, mnd: 10, end: 10,
        str, dex: 10, int, fai, arc: 10
      };
      const arResult = calculateWeaponAR(data, weaponName, affinity, upgradeLevel, stats, { twoHanding: true });
      return Math.max(arResult?.sorceryScaling?.total ?? 0, arResult?.incantationScaling?.total ?? 0);
    };

    const bruteForceResult = bruteForce3D(
      getAR,
      Math.max(10, reqs.strength), 99,
      10, 99,
      Math.max(10, reqs.faith), 99,
      budget
    );

    console.log('Clawmark Seal (3 unlocked, 2 scaling):');
    console.log(`  Our solver: STR=${result.stats.str} INT=${result.stats.int} FAI=${result.stats.fai} → ${result.damage}`);
    console.log(`  Brute force: STR=${bruteForceResult.s1} INT=${bruteForceResult.s2} FAI=${bruteForceResult.s3} → ${Math.floor(bruteForceResult.ar)}`);

    const accuracy = result.damage / Math.floor(bruteForceResult.ar);
    console.log(`  Accuracy: ${(accuracy * 100).toFixed(2)}%`);

    expect(accuracy).toBeGreaterThanOrEqual(0.99);
  });

  it('should benchmark 3-stat solver performance', () => {
    const weaponName = 'Gelmir Glintstone Staff';
    const affinity = 'Standard';
    const upgradeLevel = 10;

    const weaponData = data.weapons[weaponName];
    const reqs = weaponData.requirements;

    const statConfig: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: Math.max(10, reqs.strength), max: 99, locked: false },
      dex: { value: 10, locked: true },
      int: { min: Math.max(10, reqs.intelligence), max: 99, locked: false },
      fai: { min: Math.max(10, reqs.faith), max: 99, locked: false },
      arc: { value: 10, locked: true },
    };

    // Test various budgets
    const budgets = [30, 50, 100, 150];

    for (const budget of budgets) {
      const startTime = performance.now();
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        findOptimalStats(data, weaponName, affinity, upgradeLevel, statConfig, {
          twoHanding: false,
          pointsBudget: budget
        });
      }

      const avgTime = (performance.now() - startTime) / iterations;
      console.log(`  3-stat solver, budget=${budget}: ${avgTime.toFixed(2)}ms avg`);

      // Should still be fast enough for UI
      expect(avgTime).toBeLessThan(100);
    }
  });
});

describe('Solver - Performance', () => {
  beforeAll(() => {
    // Ensure data is loaded
    if (!data || Object.keys(data.weapons).length === 0) {
      const weaponNames = [...new Set(DIVERGENCE_CASES.map(tc => tc.weaponName))];
      data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
        weaponFilter: weaponNames,
      });
    }
  }, 30000);

  it('should complete optimization in under 50ms', () => {
    const tc = DIVERGENCE_CASES[0]; // Gelmir Glintstone Staff
    const statConfig = createStatConfig(tc.budget, tc.weaponName, tc.affinity, tc.expectedStats);

    const startTime = performance.now();

    // Run multiple times for more accurate timing
    for (let i = 0; i < 10; i++) {
      findOptimalStats(
        data,
        tc.weaponName,
        tc.affinity,
        10,
        statConfig,
        { twoHanding: tc.twoHanding, pointsBudget: tc.budget }
      );
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 10;

    console.log(`Average optimization time: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(50);
  });

  it('should handle high budgets efficiently', () => {
    // Use a Quality weapon (2 active stats) for high budget test
    // since that's the most common use case
    const tc = DIVERGENCE_CASES.find(t => t.affinity === 'Quality')!;
    const statConfig = createStatConfig(200, tc.weaponName, tc.affinity, tc.expectedStats);

    const startTime = performance.now();

    findOptimalStats(
      data,
      tc.weaponName,
      tc.affinity,
      25,
      statConfig,
      { twoHanding: tc.twoHanding, pointsBudget: 200 }
    );

    const endTime = performance.now();

    console.log(`High budget (200) optimization time: ${(endTime - startTime).toFixed(2)}ms`);
    // 2D solver is O(budget), should be very fast
    expect(endTime - startTime).toBeLessThan(100);
  });
});

// ============================================================================
// Composable Solver Unit Tests
// ============================================================================

import {
  solve,
  solve2DExact,
  solveMultiStartGreedy,
  runGreedyWithLookahead,
  generateBreakpointStarts,
  CURVE_BREAKPOINTS,
  type ARCalculator,
  type StatBoundsGetter,
} from './solver.js';

describe('Solver - Composable API', () => {
  // Mock stats type for testing
  const createMockStats = (overrides: Partial<CharacterStats> = {}): CharacterStats => ({
    vig: 10, mnd: 10, end: 10,
    str: 10, dex: 10, int: 10, fai: 10, arc: 10,
    ...overrides,
  });

  describe('solve2DExact', () => {
    it('should find optimal solution for simple quadratic AR function', () => {
      // Mock AR function: AR = str + dex - 0.01*(str - 50)^2 - 0.01*(dex - 50)^2
      // Optimal: str=50, dex=50 → AR=100
      const getAR: ARCalculator = (stats) => {
        const str = stats.str;
        const dex = stats.dex;
        return str + dex - 0.01 * (str - 50) ** 2 - 0.01 * (dex - 50) ** 2;
      };

      const getMinMax: StatBoundsGetter = (stat) => {
        if (stat === 'str') return [10, 99];
        if (stat === 'dex') return [10, 99];
        return [10, 10];
      };

      const startStats = createMockStats();
      const result = solve2DExact(startStats, ['str', 'dex'], 80, getMinMax, getAR);

      // With budget 80 from base 10+10, we can reach 50+50
      expect(result.stats.str).toBe(50);
      expect(result.stats.dex).toBe(50);
    });

    it('should handle asymmetric optima', () => {
      // Mock AR: str matters more than dex
      // AR = 2*str + dex
      const getAR: ARCalculator = (stats) => 2 * stats.str + stats.dex;

      const getMinMax: StatBoundsGetter = (stat) => {
        if (stat === 'str' || stat === 'dex') return [10, 99];
        return [10, 10];
      };

      const startStats = createMockStats();
      const result = solve2DExact(startStats, ['str', 'dex'], 30, getMinMax, getAR);

      // Should allocate all to STR since it's worth more
      expect(result.stats.str).toBe(40);
      expect(result.stats.dex).toBe(10);
    });

    it('should throw for non-2-stat input', () => {
      const getAR: ARCalculator = () => 100;
      const getMinMax: StatBoundsGetter = () => [10, 99];
      const startStats = createMockStats();

      expect(() => solve2DExact(startStats, ['str'], 30, getMinMax, getAR)).toThrow();
      expect(() => solve2DExact(startStats, ['str', 'dex', 'int'], 30, getMinMax, getAR)).toThrow();
    });
  });

  describe('runGreedyWithLookahead', () => {
    it('should allocate points greedily to highest gain', () => {
      // STR always better than DEX
      const getAR: ARCalculator = (stats) => 3 * stats.str + 1 * stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats();
      const result = runGreedyWithLookahead(startStats, ['str', 'dex'], 30, statConfigs, getAR);

      // All points should go to STR
      expect(result.stats.str).toBe(40);
      expect(result.stats.dex).toBe(10);
    });

    it('should handle 2-point lookahead for rounding issues', () => {
      // Mock scenario where 2-point allocation gives better avg gain
      // In real 2H: STR 11->12 gives 0 gain, 11->13 gives ~2 gain (avg 1/pt)
      // While DEX 10->11 gives 0.5 gain
      // 2-point lookahead should catch that 2 points to STR is better than 2x1 to DEX
      let calls = 0;
      const getAR: ARCalculator = (stats) => {
        calls++;
        // STR has rounding: only even values count
        const effectiveStr = Math.floor(stats.str / 2) * 2;
        return effectiveStr * 2 + stats.dex;
      };

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats({ str: 10, dex: 10 });
      const result = runGreedyWithLookahead(startStats, ['str', 'dex'], 10, statConfigs, getAR);

      // With this AR function, STR=20 gives 40, DEX=20 gives 20
      // So it should prefer STR even with the rounding penalty
      expect(result.stats.str).toBeGreaterThan(result.stats.dex);
    });

    it('should correctly account for points used when baseStats is provided', () => {
      // Simple linear AR: str + dex
      const getAR: ARCalculator = (stats) => stats.str + stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      // Scenario: startStats already has STR bumped to 25 (15 points used from base)
      // baseStats has STR at 10, so 25-10=15 points are already "used"
      // With budget of 30 and 15 already used, only 15 more can be allocated
      const baseStats = createMockStats({ str: 10, dex: 10 });
      const startStats = createMockStats({ str: 25, dex: 10 });

      const result = runGreedyWithLookahead(startStats, ['str', 'dex'], 30, statConfigs, getAR, {
        baseStats,
      });

      // 15 points already used (25-10), 15 more available (30-15)
      // Total allocated from base = 30
      const totalFromBase = (result.stats.str - 10) + (result.stats.dex - 10);
      expect(totalFromBase).toBe(30);
    });

    it('should allocate full budget when baseStats equals startStats', () => {
      const getAR: ARCalculator = (stats) => stats.str + stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const baseStats = createMockStats({ str: 10, dex: 10 });
      const startStats = createMockStats({ str: 10, dex: 10 });

      const result = runGreedyWithLookahead(startStats, ['str', 'dex'], 20, statConfigs, getAR, {
        baseStats,
      });

      // Should use all 20 points
      const totalFromBase = (result.stats.str - 10) + (result.stats.dex - 10);
      expect(totalFromBase).toBe(20);
    });

    it('should not allocate if budget is already exhausted by starting point', () => {
      const getAR: ARCalculator = (stats) => stats.str + stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      // startStats already uses 25 points from base, budget is only 20
      const baseStats = createMockStats({ str: 10, dex: 10 });
      const startStats = createMockStats({ str: 25, dex: 15 });

      const result = runGreedyWithLookahead(startStats, ['str', 'dex'], 20, statConfigs, getAR, {
        baseStats,
      });

      // Should not allocate any additional points - already over budget
      expect(result.stats.str).toBe(25);
      expect(result.stats.dex).toBe(15);
    });
  });

  describe('generateBreakpointStarts', () => {
    it('should generate starting points at breakpoints', () => {
      const startStats = createMockStats();
      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const starts = generateBreakpointStarts(startStats, ['str', 'dex'], 30, statConfigs);

      // Should include base case + breakpoint variations
      expect(starts.length).toBeGreaterThan(1);

      // First should be base stats
      expect(starts[0]).toEqual(startStats);

      // Should have some starting points at breakpoints
      const breakpointValues = starts.slice(1).flatMap(s => [s.str, s.dex]);
      const hasBreakpoint = CURVE_BREAKPOINTS.some(bp => breakpointValues.includes(bp));
      expect(hasBreakpoint).toBe(true);
    });

    it('should use custom breakpoints when provided', () => {
      const startStats = createMockStats();
      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        int: { min: 10, max: 99, locked: false },
      };

      const customBreakpoints = [20, 40, 60];
      const starts = generateBreakpointStarts(startStats, ['str', 'int'], 50, statConfigs, customBreakpoints);

      // Check that custom breakpoints are used
      const allStatValues = starts.flatMap(s => [s.str, s.int]);
      const usesCustom = customBreakpoints.some(bp => allStatValues.includes(bp));
      expect(usesCustom).toBe(true);
    });
  });

  describe('solveMultiStartGreedy', () => {
    it('should escape local optima with multi-start', () => {
      // AR function with local optimum trap
      // Peak at (30, 30) = 100, but local hill at (20, 20) = 60
      const getAR: ARCalculator = (stats) => {
        const str = stats.str;
        const dex = stats.dex;
        // Two peaks: one at (30,30) = 100, one at (20,20) = 60
        const peak1 = 100 - Math.abs(str - 30) - Math.abs(dex - 30);
        const peak2 = 60 - 0.5 * Math.abs(str - 20) - 0.5 * Math.abs(dex - 20);
        return Math.max(peak1, peak2);
      };

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats();
      const result = solveMultiStartGreedy(startStats, ['str', 'dex'], 40, statConfigs, getAR);

      // Should find the global optimum at (30, 30)
      expect(result.stats.str).toBeGreaterThanOrEqual(28);
      expect(result.stats.str).toBeLessThanOrEqual(32);
      expect(result.stats.dex).toBeGreaterThanOrEqual(28);
      expect(result.stats.dex).toBeLessThanOrEqual(32);
    });
  });

  describe('solve (unified)', () => {
    it('should auto-select 2D solver for 2 stats', () => {
      const getAR: ARCalculator = (stats) => stats.str + stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats();
      const result = solve(startStats, ['str', 'dex'], 30, statConfigs, getAR);

      // Should work without errors
      expect(result.damage).toBeGreaterThan(0);
    });

    it('should auto-select multi-start for 3+ stats', () => {
      const getAR: ARCalculator = (stats) => stats.str + stats.dex + stats.int;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
        int: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats();
      const result = solve(startStats, ['str', 'dex', 'int'], 30, statConfigs, getAR);

      expect(result.damage).toBeGreaterThan(0);
    });

    it('should allow forcing strategy override', () => {
      const getAR: ARCalculator = (stats) => stats.str + stats.dex;

      const statConfigs: Record<string, StatConfig> = {
        str: { min: 10, max: 99, locked: false },
        dex: { min: 10, max: 99, locked: false },
      };

      const startStats = createMockStats();

      // Force multi-start even for 2 stats
      const result = solve(startStats, ['str', 'dex'], 30, statConfigs, getAR, {
        strategy: 'multi-start-greedy',
      });

      expect(result.damage).toBeGreaterThan(0);
    });
  });

  describe('CURVE_BREAKPOINTS', () => {
    it('should be exported and contain expected breakpoints', () => {
      expect(CURVE_BREAKPOINTS).toBeDefined();
      expect(CURVE_BREAKPOINTS).toContain(18); // Common soft cap
      expect(CURVE_BREAKPOINTS).toContain(60); // Common soft cap
      expect(CURVE_BREAKPOINTS).toContain(80); // Common soft cap
      expect(CURVE_BREAKPOINTS).toContain(99); // Hard cap
    });
  });
});
